from django.contrib import admin
from django.utils.html import format_html

from news.models import (
    CombatTrainingNews,
    CombatTrainingNewsAttachment,
    CombatTrainingNewsLike,
    CombatTrainingNewsRead,
)


class CombatTrainingNewsAttachmentInline(admin.TabularInline):
    model = CombatTrainingNewsAttachment
    extra = 0
    readonly_fields = ("created_at",)


@admin.register(CombatTrainingNews)
class CombatTrainingNewsAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "created_at", "updated_at")
    search_fields = ("title", "body")
    readonly_fields = ("created_at", "updated_at")
    autocomplete_fields = ("author",)
    inlines = (CombatTrainingNewsAttachmentInline,)


@admin.register(CombatTrainingNewsAttachment)
class CombatTrainingNewsAttachmentAdmin(admin.ModelAdmin):
    list_display = ("original_name", "news", "kind", "size", "download_file", "created_at")
    list_filter = ("kind", "created_at")
    search_fields = ("original_name", "news__title")
    autocomplete_fields = ("news",)
    readonly_fields = ("download_file", "created_at")

    @admin.display(description="Файл")
    def download_file(self, obj):
        if not obj.file:
            return "—"
        return format_html('<a href="{}" target="_blank">Открыть / скачать</a>', obj.file.url)


@admin.register(CombatTrainingNewsLike)
class CombatTrainingNewsLikeAdmin(admin.ModelAdmin):
    list_display = ("news", "user", "reaction_type", "created_at")
    list_filter = ("reaction_type", "created_at")
    search_fields = ("news__title", "user__email", "user__full_name")
    autocomplete_fields = ("news", "user")
    readonly_fields = ("created_at",)


@admin.register(CombatTrainingNewsRead)
class CombatTrainingNewsReadAdmin(admin.ModelAdmin):
    list_display = ("news", "user", "read_at")
    list_filter = ("read_at",)
    search_fields = ("news__title", "user__email", "user__full_name")
    autocomplete_fields = ("news", "user")
    readonly_fields = ("read_at",)
