from django.contrib import admin
from django.utils.html import format_html

from messaging.models import AdminChatMessage


@admin.register(AdminChatMessage)
class AdminChatMessageAdmin(admin.ModelAdmin):
    list_display = (
        "sender",
        "recipient",
        "short_body",
        "attachment_kind",
        "download_attachment",
        "is_read",
        "deleted_for_everyone",
        "created_at",
    )
    list_filter = (
        "attachment_kind",
        "is_read",
        "deleted_by_sender",
        "deleted_by_recipient",
        "deleted_for_everyone",
        "created_at",
    )
    search_fields = (
        "body",
        "attachment_name",
        "sender__email",
        "sender__full_name",
        "recipient__email",
        "recipient__full_name",
    )
    autocomplete_fields = ("sender", "recipient")
    readonly_fields = ("download_attachment", "created_at")
    date_hierarchy = "created_at"

    @admin.display(description="Сообщение")
    def short_body(self, obj):
        return obj.body if len(obj.body) <= 80 else f"{obj.body[:77]}..."

    @admin.display(description="Вложение")
    def download_attachment(self, obj):
        if not obj.attachment:
            return "—"
        return format_html('<a href="{}" target="_blank">Открыть / скачать</a>', obj.attachment.url)
