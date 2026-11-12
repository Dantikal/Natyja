from django.contrib import admin
from django.utils.html import format_html

from methodical.models import MethodicalManualDocument, MethodicalManualSubject


@admin.register(MethodicalManualSubject)
class MethodicalManualSubjectAdmin(admin.ModelAdmin):
    list_display = ("title", "collection", "order", "is_active", "updated_at")
    list_editable = ("order", "is_active")
    list_filter = ("collection", "is_active")
    search_fields = ("title",)
    readonly_fields = ("created_at", "updated_at")
    ordering = ("collection", "order", "title")


@admin.register(MethodicalManualDocument)
class MethodicalManualDocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "subject", "original_name", "uploaded_by", "download_file", "created_at")
    list_filter = ("subject",)
    search_fields = ("title", "original_name", "subject__title")
    readonly_fields = ("download_file", "created_at", "updated_at")
    autocomplete_fields = ("subject", "uploaded_by")

    @admin.display(description="Скачать файл")
    def download_file(self, obj):
        if not obj.file:
            return "—"
        return format_html('<a href="{}" target="_blank">Открыть / скачать</a>', obj.file.url)
