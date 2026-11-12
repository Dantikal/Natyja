from django.db import models

from accounts.models import User


class AdminChatMessage(models.Model):
    class AttachmentKind(models.TextChoices):
        IMAGE = "image", "Image"
        VIDEO = "video", "Video"
        AUDIO = "audio", "Audio"
        FILE = "file", "File"

    sender = models.ForeignKey(
        User,
        verbose_name="Отправитель",
        on_delete=models.CASCADE,
        related_name="chat_messages_sent",
    )
    recipient = models.ForeignKey(
        User,
        verbose_name="Получатель",
        on_delete=models.CASCADE,
        related_name="chat_messages_received",
    )
    body = models.TextField("Сообщение", blank=True)
    attachment = models.FileField("Вложение", upload_to="chat/attachments/", blank=True, null=True)
    attachment_kind = models.CharField(
        "Тип вложения",
        max_length=20,
        choices=AttachmentKind.choices,
        blank=True,
        default="",
    )
    attachment_name = models.CharField("Имя вложения", max_length=255, blank=True)
    created_at = models.DateTimeField("Создано", auto_now_add=True)
    is_read = models.BooleanField("Прочитано", default=False)
    deleted_by_sender = models.BooleanField("Удалено отправителем у себя", default=False)
    deleted_by_recipient = models.BooleanField("Удалено получателем у себя", default=False)
    deleted_for_everyone = models.BooleanField("Удалено у всех", default=False)
    is_broadcast = models.BooleanField("Сообщение общей группе застав", default=False)
    broadcast_id = models.UUIDField(
        "Идентификатор рассылки",
        null=True,
        blank=True,
        db_index=True,
    )

    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        ordering = ("created_at", "id")
        verbose_name = "Сообщение чата с администратором"
        verbose_name_plural = "Сообщения чата с администратором"

    def __str__(self):
        return f"{self.sender_id} -> {self.recipient_id}: {self.body[:40]}"
