from django.urls import path

from plans.views import (
    CombatTrainingPlanDetailView,
    CombatTrainingPlanListCreateView,
    CombatTrainingPlanReadAllView,
    CombatTrainingPlanUnreadCountView,
)

urlpatterns = [
    path(
        "combat-training-plans/",
        CombatTrainingPlanListCreateView.as_view(),
        name="combat-training-plan-list",
    ),
    path(
        "combat-training-plans/<int:pk>/",
        CombatTrainingPlanDetailView.as_view(),
        name="combat-training-plan-detail",
    ),
    path(
        "combat-training-plans/unread-count/",
        CombatTrainingPlanUnreadCountView.as_view(),
        name="combat-training-plan-unread-count",
    ),
    path(
        "combat-training-plans/read-all/",
        CombatTrainingPlanReadAllView.as_view(),
        name="combat-training-plan-read-all",
    ),
]
