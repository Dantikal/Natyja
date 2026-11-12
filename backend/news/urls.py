from django.urls import path

from news.views import (
    CombatTrainingNewsDetailView,
    CombatTrainingNewsLikeView,
    CombatTrainingNewsListCreateView,
    CombatTrainingNewsReactionView,
    CombatTrainingNewsReadAllView,
    CombatTrainingNewsUnreadCountView,
)

urlpatterns = [
    path(
        "combat-training-news/",
        CombatTrainingNewsListCreateView.as_view(),
        name="combat-training-news-list",
    ),
    path(
        "combat-training-news/unread-count/",
        CombatTrainingNewsUnreadCountView.as_view(),
        name="combat-training-news-unread-count",
    ),
    path(
        "combat-training-news/read-all/",
        CombatTrainingNewsReadAllView.as_view(),
        name="combat-training-news-read-all",
    ),
    path(
        "combat-training-news/<int:pk>/",
        CombatTrainingNewsDetailView.as_view(),
        name="combat-training-news-detail",
    ),
    path(
        "combat-training-news/<int:pk>/like/",
        CombatTrainingNewsLikeView.as_view(),
        name="combat-training-news-like",
    ),
    path(
        "combat-training-news/<int:pk>/reaction/",
        CombatTrainingNewsReactionView.as_view(),
        name="combat-training-news-reaction",
    ),
]
