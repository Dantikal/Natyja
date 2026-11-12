from django.contrib import admin
from django.db import models

from common.admin import JSONModelAdmin, PrettyJSONWidget
from training.models import LessonSchedulePeriod, TrainingPeriod, TrainingSection, TrainingTable


LESSON_SCHEDULE_SECTION_SLUGS = ("lesson-schedule", "command-lesson-schedule")


class TrainingPeriodInline(admin.TabularInline):
    model = TrainingPeriod
    extra = 0
    fields = ("slug", "title", "created_by", "order", "is_active")
    autocomplete_fields = ("created_by",)
    show_change_link = True


class TrainingTableInline(admin.StackedInline):
    model = TrainingTable
    extra = 0
    max_num = 1
    formfield_overrides = {
        models.JSONField: {"widget": PrettyJSONWidget},
    }
    fields = (
        "title",
        "variant",
        "columns",
        "header_fields",
        "header_rows",
        "rows",
        "is_active",
    )


@admin.register(TrainingSection)
class TrainingSectionAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "parent", "order", "is_active")
    list_editable = ("order", "is_active")
    list_filter = ("is_active", "parent")
    search_fields = ("title", "slug")
    ordering = ("parent_id", "order", "title")
    inlines = (TrainingPeriodInline,)


@admin.register(TrainingPeriod)
class TrainingPeriodAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "section", "created_by", "order", "is_active")
    list_editable = ("order", "is_active")
    list_filter = ("is_active", "section")
    search_fields = ("title", "slug", "section__title", "created_by__email", "created_by__full_name")
    ordering = ("section", "order", "title")
    autocomplete_fields = ("section", "created_by")
    inlines = (TrainingTableInline,)


@admin.register(LessonSchedulePeriod)
class LessonSchedulePeriodAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "section", "order", "is_active")
    list_editable = ("order", "is_active")
    list_filter = ("is_active", "section")
    search_fields = ("title", "slug", "section__title")
    ordering = ("section", "order", "title")
    inlines = (TrainingTableInline,)

    def get_queryset(self, request):
        return super().get_queryset(request).filter(section__slug__in=LESSON_SCHEDULE_SECTION_SLUGS)

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "section":
            kwargs["queryset"] = TrainingSection.objects.filter(slug__in=LESSON_SCHEDULE_SECTION_SLUGS)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


@admin.register(TrainingTable)
class TrainingTableAdmin(JSONModelAdmin):
    list_display = ("title", "period", "variant", "json_summary", "is_active", "updated_at")
    list_filter = ("is_active", "variant", "period__section")
    search_fields = ("title", "period__title", "period__section__title")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("period",)
    autocomplete_fields = ("period",)
