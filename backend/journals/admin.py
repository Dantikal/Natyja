from django.contrib import admin

from journals.models import CombatTrainingJournal, CombatTrainingJournalSection
from training.admin import TrainingPeriodInline


COMBAT_TRAINING_JOURNAL_SECTION_SLUG = "combat-training-journal"


@admin.register(CombatTrainingJournalSection)
class CombatTrainingJournalSectionAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "order", "is_active")
    list_editable = ("order", "is_active")
    search_fields = ("title", "slug")
    inlines = (TrainingPeriodInline,)

    def get_queryset(self, request):
        return super().get_queryset(request).filter(slug=COMBAT_TRAINING_JOURNAL_SECTION_SLUG)


@admin.register(CombatTrainingJournal)
class CombatTrainingJournalAdmin(admin.ModelAdmin):
    list_display = ("title", "year", "unit_name", "scope", "owner", "created_at")
    list_filter = ("scope", "created_at", "owner")
    search_fields = ("title", "year", "unit_name", "scope", "storage_id")
    readonly_fields = ("created_at", "updated_at")
    autocomplete_fields = ("owner",)
    ordering = ("-created_at", "-id")
