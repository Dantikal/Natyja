from rest_framework.permissions import BasePermission


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.status == user.Status.ACTIVE
            and (user.role == user.Role.ADMIN or user.is_superuser)
        )


class IsAdminOrRegionalRole(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.status == user.Status.ACTIVE
            and (user.role in {user.Role.ADMIN, user.Role.REGIONAL} or user.is_superuser)
        )


class IsPrimaryAdmin(BasePermission):
    message = "Это действие доступно только главному администратору."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.status == user.Status.ACTIVE
            and user.is_superuser
        )


class IsActiveUser(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if user and user.is_authenticated and user.role == user.Role.MANAGEMENT and request.method not in {"GET", "HEAD", "OPTIONS"}:
            if view.__class__.__name__ not in {"AdminChatMessageView", "AdminChatMessageDeleteView", "AdminChatConversationDeleteView"}:
                return False
        return bool(
            user and user.is_authenticated and user.status == user.Status.ACTIVE
        )

