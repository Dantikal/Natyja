from accounts.management_views import ManagementOverviewView
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.views import (
    AdminQuickUserCreateView,
    AdminUserDetailView,
    AdminUsersView,
    LoginView,
    MeView,
    ModerateRequestView,
    PendingRequestsView,
    RegisterView,
    TrainingCenterListView,
    ScopedUsersView,
    UserRequestDetailView,
)

from accounts.platform_team import PlatformTeamView

urlpatterns = [
    path("management/overview/", ManagementOverviewView.as_view(), name="management-overview"),
    path("platform-team/", PlatformTeamView.as_view(), name="platform-team"),
    path("training-centers/", TrainingCenterListView.as_view(), name="training-centers"),
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("users/", ScopedUsersView.as_view(), name="scoped-users"),
    path("admin/users/", AdminUsersView.as_view(), name="admin-users"),
    path("admin/users/quick/", AdminQuickUserCreateView.as_view(), name="admin-user-quick-create"),
    path("admin/users/<int:pk>/", AdminUserDetailView.as_view(), name="admin-user-detail"),
    path("admin/requests/", PendingRequestsView.as_view(), name="pending-requests"),
    path("admin/requests/<int:pk>/", UserRequestDetailView.as_view(), name="request-detail"),
    path("admin/requests/<int:pk>/moderate/", ModerateRequestView.as_view(), name="moderate-request"),
]

# Chat retains its existing /api/auth/chat/... addresses.

urlpatterns += [path("", include("messaging.urls"))]
