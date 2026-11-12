from datetime import timedelta

from django.utils import timezone
from rest_framework_simplejwt.authentication import JWTAuthentication


class ActivityJWTAuthentication(JWTAuthentication):
    """Record recent API activity without writing on every single request."""

    update_interval = timedelta(seconds=30)

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None

        user, validated_token = result
        now = timezone.now()
        if not user.last_login or now - user.last_login >= self.update_interval:
            type(user).objects.filter(pk=user.pk).update(last_login=now)
            user.last_login = now
        unit = request.headers.get("X-Observe-Unit")
        if unit:
            from accounts.models import User
            from accounts.management_scope import MANAGEMENT_UNITS
            from rest_framework.exceptions import PermissionDenied, NotFound
            if user.role not in {User.Role.MANAGEMENT, User.Role.REGIONAL} or user.status != User.Status.ACTIVE or unit not in MANAGEMENT_UNITS.get(user.region, ()):
                raise PermissionDenied("Unit is outside your observation scope.")
            if request.method not in {"GET", "HEAD", "OPTIONS"}:
                raise PermissionDenied("Observed cabinets are read-only.")
            if not (request.path.startswith('/api/dashboard/') or request.path.startswith('/api/auth/chat/') or request.path.startswith('/api/training/')):
                raise PermissionDenied("This endpoint is unavailable in observation mode.")
            target = User.objects.filter(region=unit, role=User.Role.REGIONAL, status=User.Status.ACTIVE).order_by('id').first()
            if target is None:
                raise NotFound("Для этой части пока нет активной учётной записи.")
            request.observer = user
            request.observed_unit = unit
            return target, validated_token
        return user, validated_token
