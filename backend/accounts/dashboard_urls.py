"""Legacy dashboard URL entrypoint, composed from domain applications."""

from django.urls import include, path

urlpatterns = [
    path("", include("dashboard.urls")),
    path("", include("content.urls")),
    path("", include("plans.urls")),
    path("", include("submissions.urls")),
    path("", include("training.urls")),
    path("", include("methodical.urls")),
    path("", include("journals.urls")),
    path("", include("news.urls")),
]
