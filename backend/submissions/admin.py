from django.contrib import admin

from common.admin import JSONModelAdmin
from submissions.models import SubmissionEditRequest, ThematicAccountSubmission


@admin.register(ThematicAccountSubmission)
class ThematicAccountSubmissionAdmin(JSONModelAdmin):
    list_display = (
        "document_title",
        "sender",
        "unit_number",
        "outpost_name",
        "section_slug",
        "period_slug",
        "json_summary",
        "created_at",
    )
    list_filter = ("section_slug", "period_slug", "created_at")
    search_fields = (
        "document_title",
        "unit_number",
        "outpost_name",
        "section_slug",
        "period_slug",
        "sender__email",
        "sender__full_name",
    )
    autocomplete_fields = ("sender",)
    readonly_fields = ("created_at",)
    date_hierarchy = "created_at"
    ordering = ("-created_at", "-id")


@admin.register(SubmissionEditRequest)
class SubmissionEditRequestAdmin(admin.ModelAdmin):
    list_display = ("submission", "requester", "status", "reviewed_by", "updated_at")
    list_filter = ("status", "requester__role", "updated_at")
    search_fields = ("submission__document_title", "requester__email", "requester__full_name")
    autocomplete_fields = ("submission", "requester", "reviewed_by")
    readonly_fields = ("created_at", "updated_at", "reviewed_at")
