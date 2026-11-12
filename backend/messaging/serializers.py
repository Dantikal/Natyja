from accounts.management_scope import management_chat_allowed
from rest_framework import serializers

from accounts.models import User
from accounts.training_units import TRAINING_UNIT_TYPES, training_chat_allowed
from accounts.serializers import UserPublicSerializer
from messaging.models import AdminChatMessage


class AdminChatMessageSerializer(serializers.ModelSerializer):
    sender = UserPublicSerializer(read_only=True)
    recipient = UserPublicSerializer(read_only=True)
    senderId = serializers.IntegerField(write_only=True, required=False)
    recipientId = serializers.IntegerField(write_only=True, required=False)
    attachment = serializers.FileField(required=False, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    isRead = serializers.BooleanField(source="is_read", read_only=True)
    isDeletedForEveryone = serializers.BooleanField(
        source="deleted_for_everyone", read_only=True
    )
    isBroadcast = serializers.BooleanField(source="is_broadcast", read_only=True)
    broadcastId = serializers.UUIDField(source="broadcast_id", read_only=True)

    class Meta:
        model = AdminChatMessage
        fields = [
            "id",
            "sender",
            "recipient",
            "senderId",
            "recipientId",
            "body",
            "attachment",
            "attachment_kind",
            "attachment_name",
            "createdAt",
            "isRead",
            "isDeletedForEveryone",
            "isBroadcast",
            "broadcastId",
        ]
        read_only_fields = [
            "id",
            "sender",
            "recipient",
            "attachment_kind",
            "attachment_name",
            "isRead",
            "isDeletedForEveryone",
            "isBroadcast",
            "broadcastId",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.deleted_for_everyone:
            data["body"] = ""
            data["attachment"] = None
            data["attachment_kind"] = ""
            data["attachment_name"] = ""
        return data

    def validate(self, attrs):
        request_user = self.context["request"].user
        body = (attrs.get("body") or "").strip()
        attachment = attrs.get("attachment")
        if not body and not attachment:
            raise serializers.ValidationError({"body": "Введите текст или добавьте вложение."})

        recipient_id = attrs.get("recipientId")
        if (request_user.role in {User.Role.ADMIN, User.Role.REGIONAL} or request_user.unit_type in TRAINING_UNIT_TYPES) and not recipient_id:
            raise serializers.ValidationError({"recipientId": "Укажите получателя."})
        if recipient_id:
            recipient = User.objects.filter(pk=recipient_id, status=User.Status.ACTIVE).first()
            if not recipient:
                raise serializers.ValidationError({"recipientId": "Пользователь не найден."})
            if recipient.pk == request_user.pk:
                raise serializers.ValidationError({"recipientId": "Нельзя отправить сообщение самому себе."})

            is_allowed = False
            if request_user.role == User.Role.ADMIN:
                is_allowed = recipient.role in {User.Role.REGIONAL, User.Role.OUTPOST}
            elif request_user.role == User.Role.OUTPOST:
                is_matching_regional = (
                    recipient.role in {User.Role.REGIONAL, User.Role.OUTPOST}
                    and bool(request_user.region)
                    and recipient.region == request_user.region
                )
                is_allowed = is_matching_regional or recipient.role == User.Role.ADMIN
            elif request_user.role == User.Role.REGIONAL:
                is_allowed = recipient.role == User.Role.ADMIN or (
                    recipient.role == User.Role.OUTPOST
                    and recipient.region == request_user.region
                )
            if request_user.role == User.Role.MANAGEMENT or recipient.role == User.Role.MANAGEMENT:
                is_allowed = management_chat_allowed(request_user, recipient)
                if attachment:
                    raise serializers.ValidationError({'attachment':'Управления используют текстовый чат. Отправка документов недоступна.'})
            if request_user.unit_type in TRAINING_UNIT_TYPES:
                is_allowed = training_chat_allowed(request_user, recipient)
            elif recipient.unit_type == User.UnitType.TRAINING_PLATOON_COMMANDER and request_user.role != User.Role.ADMIN:
                is_allowed = False
            if not is_allowed:
                raise serializers.ValidationError({"recipientId": "Бул алуучуга билдирүү жөнөтүүгө болбойт."})

        attrs["body"] = body
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        sender = request.user
        recipient_id = validated_data.pop("recipientId", None)
        validated_data.pop("senderId", None)
        attachment = validated_data.get("attachment")

        if recipient_id:
            recipient = User.objects.filter(pk=recipient_id).first()
        else:
            recipient = User.objects.filter(role=User.Role.ADMIN).order_by("id").first()
        if not recipient:
            raise serializers.ValidationError({"recipientId": "Администратор не найден."})

        if attachment and not validated_data.get("attachment_name"):
            validated_data["attachment_name"] = attachment.name
        if attachment and not validated_data.get("attachment_kind"):
            name = attachment.name.lower()
            content_type = getattr(attachment, "content_type", "") or ""
            if content_type.startswith("image/") or name.endswith((".png", ".jpg", ".jpeg", ".gif", ".webp")):
                validated_data["attachment_kind"] = AdminChatMessage.AttachmentKind.IMAGE
            elif content_type.startswith("audio/") or name.endswith((".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac")):
                validated_data["attachment_kind"] = AdminChatMessage.AttachmentKind.AUDIO
            elif content_type.startswith("video/") or name.endswith((".mp4", ".mov", ".avi", ".mkv", ".webm")):
                validated_data["attachment_kind"] = AdminChatMessage.AttachmentKind.VIDEO
            else:
                validated_data["attachment_kind"] = AdminChatMessage.AttachmentKind.FILE

        return AdminChatMessage.objects.create(sender=sender, recipient=recipient, **validated_data)


class AdminChatUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "full_name", "email", "role", "avatar", "photo_face"]
        read_only_fields = fields
