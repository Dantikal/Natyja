from django.contrib import admin

from common.admin import JSONModelAdmin
from plans.models import CombatTrainingPlan


@admin.register(CombatTrainingPlan)
class CombatTrainingPlanAdmin(JSONModelAdmin):
    list_display = ("title", "layout", "created_by", "json_summary", "created_at", "updated_at")
    list_filter = ("layout", "created_at", "updated_at")
    search_fields = ("title", "layout", "created_by__email", "created_by__full_name")
    autocomplete_fields = ("created_by",)
    readonly_fields = ("created_at", "updated_at")
    date_hierarchy = "created_at"
