from django.core.mail import send_mail
from django.db.models import Q
from rest_framework import generics, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.unit_routing import regional_user_filter
from accounts.permissions import IsActiveUser, IsAdminRole, IsPrimaryAdmin
from accounts.serializers import (
    ActiveTokenObtainSerializer,
    AdminUserSerializer,
    ModerationSerializer,
    ProfileUpdateSerializer,
    QuickUserCreateSerializer,
    RegistrationSerializer,
    UserPublicSerializer,
)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegistrationSerializer
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                "message": "Өтүнмө администратордун кароосуна жөнөтүлдү.",
                "user": UserPublicSerializer(user, context=self.get_serializer_context()).data,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [JSONParser]

    def post(self, request):
        serializer = ActiveTokenObtainSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)


class PendingRequestsView(generics.ListAPIView):
    serializer_class = UserPublicSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        return (
            User.objects.filter(status=User.Status.PENDING)
            .exclude(role=User.Role.ADMIN)
            .order_by("-date_joined")
        )


class UserRequestDetailView(generics.RetrieveAPIView):
    serializer_class = UserPublicSerializer
    permission_classes = [IsAdminRole]
    queryset = User.objects.exclude(role=User.Role.ADMIN)


class AdminUsersView(generics.ListCreateAPIView):
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdminRole]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return User.objects.all().order_by("-date_joined", "-id")

    def list(self, request, *args, **kwargs):
        if request.query_params.get("paged") != "1":
            return super().list(request, *args, **kwargs)
        users = self.get_queryset()
        for key, field in [("role", "role"), ("status", "status"), ("unit", "region")]:
            if request.query_params.get(key):
                users = users.filter(**{field: request.query_params[key]})
        search = request.query_params.get("search", "").strip()
        if search:
            query = Q()
            for field in ["full_name", "email", "phone", "military_rank", "position", "region", "outpost_name"]:
                query |= Q(**{field + "__icontains": search})
            users = users.filter(query)
        try:
            offset = max(0, int(request.query_params.get("offset", "0")))
        except ValueError:
            offset = 0
        count = users.count()
        page = users[offset:offset + 10]
        return Response({"results": self.get_serializer(page, many=True).data, "count": count, "nextOffset": offset + 10 if offset + 10 < count else None})


class AdminQuickUserCreateView(generics.CreateAPIView):
    serializer_class = QuickUserCreateSerializer
    permission_classes = [IsAdminRole]
    parser_classes = [JSONParser]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            AdminUserSerializer(user, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class AdminUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdminRole]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return User.objects.all()

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        if user.is_superuser and not request.user.is_superuser:
            return Response(
                {"detail": "Изменять главного администратора может только главный администратор."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.is_superuser and not request.user.is_superuser:
            return Response(
                {"detail": "Удалять главного администратора может только главный администратор."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if user.id == request.user.id:
            return Response(
                {"detail": "Нельзя удалить свою учетную запись."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.role == User.Role.ADMIN and not User.objects.filter(
            role=User.Role.ADMIN
        ).exclude(pk=user.pk).exists():
            return Response(
                {"detail": "Нельзя удалить последнего администратора."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ModerateRequestView(APIView):
    permission_classes = [IsPrimaryAdmin]

    def post(self, request, pk):
        user_to_review = generics.get_object_or_404(
            User.objects.exclude(role=User.Role.ADMIN), pk=pk
        )
        if user_to_review.status != User.Status.PENDING:
            return Response(
                {"detail": "Эта заявка уже обработана."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ModerationSerializer(
            data=request.data,
            context={"request": request, "user_to_review": user_to_review},
        )
        serializer.is_valid(raise_exception=True)
        result = serializer.save()

        if result["status"] == "rejected":
            send_mail(
                "Заявка на доступ отклонена",
                user_to_review.rejection_reason,
                None,
                [user_to_review.email],
                fail_silently=True,
            )

        return Response(result)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserPublicSerializer
    permission_classes = [IsActiveUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        return self.request.user

    def patch(self, request, *args, **kwargs):
        serializer = ProfileUpdateSerializer(
            self.get_object(), data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserPublicSerializer(user, context={"request": request}).data)


class ScopedUsersView(generics.ListAPIView):
    serializer_class = AdminUserSerializer
    permission_classes = [IsActiveUser]

    def get_queryset(self):
        user = self.request.user
        qs = User.objects.filter(status=User.Status.ACTIVE)

        if user.role == User.Role.ADMIN:
            return qs.order_by("region", "outpost_name", "full_name")
        if user.role == User.Role.REGIONAL:
            return qs.filter(regional_user_filter(user)).order_by("outpost_name", "full_name")
        return qs.filter(
            Q(id=user.id) | Q(region=user.region, outpost_name=user.outpost_name)
        ).order_by("full_name")


# Resolve former imports lazily to avoid circular dependencies between apps.
_LEGACY_IMPORTS = {
    "AdminChatConversationDeleteView": "messaging.views",
    "AdminChatMessageDeleteView": "messaging.views",
    "AdminChatMessageView": "messaging.views",
    "AdminChatOutpostBroadcastView": "messaging.views",
    "ChatPartnerListView": "messaging.views",
    "ChatUnreadCountView": "messaging.views",
}


def __getattr__(name):
    module = _LEGACY_IMPORTS.get(name)
    if module is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    from importlib import import_module

    value = getattr(import_module(module), name)
    globals()[name] = value
    return value


class TrainingCenterListView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        centers = User.objects.filter(
            unit_type=User.UnitType.TRAINING_CENTER_HEAD,
            status__in=[User.Status.PENDING, User.Status.ACTIVE],
        ).exclude(outpost_name="").order_by("region", "outpost_name", "id")
        return Response([
            {"id": center.id, "name": center.outpost_name, "region": center.region}
            for center in centers
        ])
