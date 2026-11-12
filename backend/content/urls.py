from django.urls import path

from content.views import (
    ModuleBannerDetailView,
    ModuleBannerListCreateView,
    ModuleTemplateDetailView,
    ModuleTemplateListCreateView,
)

urlpatterns = [
    path("module-banners/", ModuleBannerListCreateView.as_view(), name="module-banner-list"),
    path("module-banners/<int:pk>/", ModuleBannerDetailView.as_view(), name="module-banner-detail"),
    path("module-templates/", ModuleTemplateListCreateView.as_view(), name="module-template-list"),
    path("module-templates/<int:pk>/", ModuleTemplateDetailView.as_view(), name="module-template-detail"),
]
