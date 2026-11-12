from django.urls import path

from training.views import (
    LessonSchedulePeriodDetailView,
    LessonSchedulePeriodListCreateView,
    LibraryPeriodDetailView,
    LibraryPeriodListCreateView,
)

urlpatterns = [
    path(
        "lesson-schedule-periods/<slug:section_slug>/<str:period_slug>/",
        LessonSchedulePeriodDetailView.as_view(),
        name="lesson-schedule-period-detail",
    ),
    path(
        "lesson-schedule-periods/",
        LessonSchedulePeriodListCreateView.as_view(),
        name="lesson-schedule-period-list",
    ),
    path(
        "library-periods/",
        LibraryPeriodListCreateView.as_view(),
        name="library-period-list",
    ),
    path(
        "library-periods/<slug:section_slug>/<str:period_slug>/",
        LibraryPeriodDetailView.as_view(),
        name="library-period-detail",
    ),
]
