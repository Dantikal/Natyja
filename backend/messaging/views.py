from accounts.management_scope import subordinate_users, MANAGEMENT_UNITS
from datetime import timedelta
import uuid

from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Q, OuterRef, Subquery, Count, IntegerField
from django.db.models.functions import Coalesce
from rest_framework import generics, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError

from accounts.models import User
from accounts.permissions import IsActiveUser, IsAdminRole
from accounts.serializers import UserPublicSerializer
from messaging.models import AdminChatMessage
from messaging.serializers import AdminChatMessageSerializer


class AdminChatMessageView(generics.ListCreateAPIView):
    serializer_class = AdminChatMessageSerializer
    permission_classes = [IsActiveUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        qs = AdminChatMessage.objects.select_related("sender", "recipient").order_by("created_at", "id")

        partner_id = self.request.query_params.get("user_id")
        scope = self.request.query_params.get("scope")
        if scope == "outpost_broadcast" and user.role in {User.Role.ADMIN, User.Role.OUTPOST}:
            if user.role == User.Role.ADMIN:
                broadcast_queryset = qs.filter(sender=user, is_broadcast=True)
            else:
                broadcast_queryset = qs.filter(recipient=user, is_broadcast=True)
            return broadcast_queryset.exclude(
                Q(sender=user, deleted_by_sender=True)
                | Q(recipient=user, deleted_by_recipient=True)
            )

        qs = qs.filter(Q(sender=user) | Q(recipient=user), is_broadcast=False)
        if partner_id:
            qs = qs.filter(
                Q(sender_id=partner_id, recipient=user)
                | Q(sender=user, recipient_id=partner_id)
            )

        return qs.exclude(
            Q(sender=user, deleted_by_sender=True)
            | Q(recipient=user, deleted_by_recipient=True)
        )

    def perform_create(self, serializer):
        serializer.save()

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        user = request.user
        partner_id = request.query_params.get("user_id")
        scope = request.query_params.get("scope")
        if not getattr(request, "observer", None) and scope == "outpost_broadcast" and user.role == User.Role.OUTPOST:
            queryset.filter(recipient=user, is_read=False).update(is_read=True)
        if partner_id and not getattr(request, "observer", None):
            AdminChatMessage.objects.filter(
                sender_id=partner_id,
                recipient=user,
                is_read=False,
            ).update(is_read=True)

        if request.query_params.get("paged") == "1":
            try:
                before = int(request.query_params.get("beforeId", "0"))
                limit = min(100, max(1, int(request.query_params.get("limit", "50"))))
            except ValueError:
                raise ValidationError({"pagination": "Invalid chat cursor."})
            if before:
                queryset = queryset.filter(pk__lt=before)
            page = list(queryset.order_by("-pk")[:limit + 1])
            has_more = len(page) > limit
            page = page[:limit]
            return Response({
                "results": self.get_serializer(list(reversed(page)), many=True).data,
                "nextCursor": page[-1].pk if has_more else None,
            })
        return Response(self.get_serializer(queryset, many=True).data)


class ChatPartnerListView(generics.ListAPIView):
    serializer_class = UserPublicSerializer
    permission_classes = [IsActiveUser]

    def list(self, request, *args, **kwargs):
        user = request.user
        visible = AdminChatMessage.objects.filter(
            Q(sender=user, recipient_id=OuterRef("pk")) | Q(sender_id=OuterRef("pk"), recipient=user),
            is_broadcast=False,
        ).exclude(Q(sender=user, deleted_by_sender=True) | Q(recipient=user, deleted_by_recipient=True))
        latest = visible.order_by("-created_at", "-id")
        unread = visible.filter(recipient=user, is_read=False, deleted_for_everyone=False).values("sender_id").annotate(total=Count("pk")).values("total")
        queryset = self.get_queryset().annotate(
            _chat_unread=Coalesce(Subquery(unread[:1]), 0, output_field=IntegerField()),
            _chat_last_at=Subquery(latest.values("created_at")[:1]),
            _chat_last_body=Subquery(latest.values("body")[:1]),
            _chat_last_file=Subquery(latest.values("attachment_name")[:1]),
            _chat_last_sender=Subquery(latest.values("sender_id")[:1]),
            _chat_last_deleted=Subquery(latest.values("deleted_for_everyone")[:1]),
        )
        items = list(queryset)
        payload = self.get_serializer(items, many=True).data
        for item, data in zip(items, payload):
            data["lastMessageAt"] = item._chat_last_at.isoformat() if item._chat_last_at else None
            data["lastMessagePreview"] = "" if item._chat_last_deleted else (item._chat_last_body or item._chat_last_file or "")[:160]
            data["lastMessageFromMe"] = item._chat_last_sender == user.id
        return Response(payload)

    def get_queryset(self):
        user = self.request.user
        users = User.objects.filter(status=User.Status.ACTIVE).exclude(pk=user.pk)
        if user.unit_type == User.UnitType.TRAINING_CENTER_HEAD:
            return users.filter(training_center=user, unit_type=User.UnitType.TRAINING_PLATOON_COMMANDER).order_by("platoon_number", "id")
        if user.unit_type == User.UnitType.TRAINING_PLATOON_COMMANDER:
            return users.filter(pk=user.training_center_id, unit_type=User.UnitType.TRAINING_CENTER_HEAD)
        if user.role == User.Role.MANAGEMENT:
            return users.filter(Q(pk__in=subordinate_users(user).values('pk')) | Q(role=User.Role.ADMIN)).order_by('role','region','outpost_name')
        management_ids=[number for number, units in MANAGEMENT_UNITS.items() if user.region in units]
        managed_by=Q(role=User.Role.MANAGEMENT,region__in=management_ids)
        if user.role == User.Role.ADMIN:
            return users.filter(
                role__in={User.Role.REGIONAL, User.Role.OUTPOST, User.Role.MANAGEMENT}
            ).order_by("role", "region", "outpost_name", "full_name")
        if user.role == User.Role.REGIONAL:
            return users.filter(
                (Q(role=User.Role.OUTPOST, region=user.region) & ~Q(unit_type=User.UnitType.TRAINING_PLATOON_COMMANDER)) | Q(role=User.Role.ADMIN) | managed_by
            ).order_by("role", "outpost_name", "full_name")
        if user.role == User.Role.OUTPOST:
            return users.filter(
                (Q(role__in=[User.Role.REGIONAL, User.Role.OUTPOST], region=user.region) & ~Q(unit_type=User.UnitType.TRAINING_PLATOON_COMMANDER))
                | Q(role=User.Role.ADMIN) | managed_by
            ).distinct().order_by("role", "full_name")
        return users.none()


class ChatUnreadCountView(APIView):
    permission_classes = [IsActiveUser]

    def get(self, request):
        unread_count = AdminChatMessage.objects.filter(
            recipient=request.user,
            is_read=False,
        ).count()
        return Response({"unreadCount": unread_count})


class AdminChatMessageDeleteView(APIView):
    permission_classes = [IsActiveUser]

    def delete(self, request, pk):
        user = request.user
        message = generics.get_object_or_404(
            AdminChatMessage.objects.filter(Q(sender=user) | Q(recipient=user)),
            pk=pk,
        )
        if message.is_broadcast and user.role != User.Role.ADMIN:
            return Response(
                {"detail": "Жалпы топтун билдирүүсүн администратор гана өчүрө алат."},
                status=status.HTTP_403_FORBIDDEN,
            )
        mode = request.data.get("mode", "self")

        if mode == "everyone":
            if message.sender_id != user.id:
                return Response(
                    {"detail": "Удалить сообщение у всех может только отправитель."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            if message.is_broadcast:
                if user.role != User.Role.ADMIN:
                    return Response(
                        {"detail": "Жалпы топтун билдирүүсүн администратор гана өчүрө алат."},
                        status=status.HTTP_403_FORBIDDEN,
                    )
                if message.broadcast_id:
                    broadcast_messages = AdminChatMessage.objects.filter(
                        sender=user,
                        is_broadcast=True,
                        broadcast_id=message.broadcast_id,
                    )
                else:
                    time_margin = timedelta(seconds=2)
                    broadcast_messages = AdminChatMessage.objects.filter(
                        sender=user,
                        is_broadcast=True,
                        body=message.body,
                        attachment_name=message.attachment_name,
                        created_at__gte=message.created_at - time_margin,
                        created_at__lte=message.created_at + time_margin,
                    )
                attachments = [
                    item.attachment
                    for item in broadcast_messages
                    if item.attachment
                ]
                broadcast_messages.update(
                    body="",
                    attachment=None,
                    attachment_kind="",
                    attachment_name="",
                    deleted_for_everyone=True,
                )
                for attachment in attachments:
                    attachment.delete(save=False)
                message.refresh_from_db()
                return Response(
                    AdminChatMessageSerializer(message, context={"request": request}).data
                )

            if message.attachment:
                message.attachment.delete(save=False)
            message.body = ""
            message.attachment = None
            message.attachment_kind = ""
            message.attachment_name = ""
            message.deleted_for_everyone = True
            message.save(
                update_fields=(
                    "body",
                    "attachment",
                    "attachment_kind",
                    "attachment_name",
                    "deleted_for_everyone",
                )
            )
            return Response(
                AdminChatMessageSerializer(message, context={"request": request}).data
            )

        if message.sender_id == user.id:
            message.deleted_by_sender = True
            message.save(update_fields=("deleted_by_sender",))
        else:
            message.deleted_by_recipient = True
            message.save(update_fields=("deleted_by_recipient",))

        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminChatConversationDeleteView(APIView):
    permission_classes = [IsAdminRole]

    @transaction.atomic
    def delete(self, request, partner_pk):
        partner = generics.get_object_or_404(
            User.objects.filter(
                status=User.Status.ACTIVE,
                role__in={User.Role.REGIONAL, User.Role.OUTPOST},
            ),
            pk=partner_pk,
        )
        messages = AdminChatMessage.objects.filter(
            Q(sender=request.user, recipient=partner)
            | Q(sender=partner, recipient=request.user)
        ).filter(is_broadcast=False)
        attachments = [message.attachment for message in messages if message.attachment]
        messages.delete()
        for attachment in attachments:
            attachment.delete(save=False)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminChatOutpostBroadcastView(APIView):
    permission_classes = [IsAdminRole]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @transaction.atomic
    def post(self, request):
        audience = request.data.get("audience")
        allowed = ChatPartnerListView()
        allowed.request = request
        queryset = allowed.get_queryset()
        if audience is None:
            queryset = queryset.filter(role=User.Role.OUTPOST)
        elif audience in {"regional", "outpost"}:
            queryset = queryset.filter(role=audience)
        elif audience == "selected":
            raw_ids = request.data.getlist("recipientIds") if hasattr(request.data, "getlist") else request.data.get("recipientIds", [])
            try:
                if not isinstance(raw_ids, list) or not raw_ids:
                    raise ValueError()
                ids = set(int(value) for value in raw_ids)
            except (ValueError, TypeError):
                return Response({"detail": "Выберите получателей."}, status=400)
            queryset = queryset.filter(pk__in=ids)
            if queryset.count() != len(ids):
                return Response({"detail": "Один из получателей недоступен."}, status=400)
        elif audience != "all":
            return Response({"detail": "Неизвестная группа получателей."}, status=400)
        recipients = list(queryset.order_by("id"))
        if not recipients:
            return Response(
                {"detail": "Активдүү заставалар табылган жок."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        body = str(request.data.get("body") or "").strip()
        uploaded_file = request.FILES.get("attachment")
        if not body and not uploaded_file:
            return Response(
                {"body": ["Введите текст или добавьте вложение."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        attachment_bytes = uploaded_file.read() if uploaded_file else None
        broadcast_id = uuid.uuid4()
        for recipient in recipients:
            payload = {"body": body, "recipientId": recipient.id}
            if uploaded_file:
                payload["attachment"] = ContentFile(
                    attachment_bytes,
                    name=uploaded_file.name,
                )
            serializer = AdminChatMessageSerializer(
                data=payload,
                context={"request": request},
            )
            serializer.is_valid(raise_exception=True)
            serializer.save(is_broadcast=audience is None, broadcast_id=broadcast_id)

        return Response(
            {"recipientCount": len(recipients)},
            status=status.HTTP_201_CREATED,
        )
