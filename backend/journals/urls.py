from django.urls import path

from journals.views import (
    CombatTrainingJournalDetailView,
    CombatTrainingJournalListCreateView,
    CombatTrainingJournalOutpostListView,
    CombatTrainingJournalSubjectDetailView,
    CombatTrainingJournalSubjectListCreateView,
)

urlpatterns = [
    path(
        "combat-training-journals/",
        CombatTrainingJournalListCreateView.as_view(),
        name="combat-training-journal-list",
    ),
    path(
        "combat-training-journal-subjects/",
        CombatTrainingJournalSubjectListCreateView.as_view(),
        name="combat-training-journal-subject-list",
    ),
    path(
        "combat-training-journal-subjects/<int:pk>/",
        CombatTrainingJournalSubjectDetailView.as_view(),
        name="combat-training-journal-subject-detail",
    ),
    path(
        "combat-training-journal-outposts/",
        CombatTrainingJournalOutpostListView.as_view(),
        name="combat-training-journal-outpost-list",
    ),
    path(
        "combat-training-journals/<int:pk>/",
        CombatTrainingJournalDetailView.as_view(),
        name="combat-training-journal-detail",
    ),
]
