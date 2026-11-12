from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsActiveUser
from plans.models import CombatTrainingPlan, CombatTrainingPlanRead
from plans.serializers import combat_training_plan_payload


class CombatTrainingPlanListCreateView(APIView):
    permission_classes = [IsActiveUser]

    def get(self, request):
        layout = str(request.query_params.get("layout") or "plan").strip()
        plans = CombatTrainingPlan.objects.filter(layout=layout)
        return Response([combat_training_plan_payload(plan) for plan in plans])

    def post(self, request):
        if request.user.role != User.Role.ADMIN:
            raise PermissionDenied("Планды администратор гана түзө алат.")

        title = str(request.data.get("title") or "").strip()
        layout = str(request.data.get("layout") or "plan").strip()
        if not title:
            raise ValidationError({"title": "Разделдин аталышын жазыңыз."})
        if layout not in {"plan", "draft"}:
            raise ValidationError({"layout": "Таблицанын түрү туура эмес."})

        data = dict(request.data.get("data") or {})
        plan = CombatTrainingPlan.objects.create(
            title=title,
            layout=layout,
            data=data,
            created_by=request.user,
        )
        return Response(combat_training_plan_payload(plan), status=201)


class CombatTrainingPlanDetailView(APIView):
    permission_classes = [IsActiveUser]

    def get_object(self, pk):
        return get_object_or_404(CombatTrainingPlan, pk=pk)

    def patch(self, request, pk):
        if request.user.role != User.Role.ADMIN:
            raise PermissionDenied("Планды администратор гана өзгөртө алат.")

        plan = self.get_object(pk)
        if "title" in request.data:
            title = str(request.data.get("title") or "").strip()
            if not title:
                raise ValidationError({"title": "Разделдин аталышын жазыңыз."})
            plan.title = title
        if "data" in request.data:
            data = request.data.get("data")
            if not isinstance(data, dict):
                raise ValidationError({"data": "Таблицанын маалыматы туура эмес."})
            previous_sent_at = str((plan.data or {}).get("sentAt") or "")
            next_sent_at = str(data.get("sentAt") or "")
            if next_sent_at and next_sent_at != previous_sent_at:
                plan.published_at = timezone.now()
            plan.data = data
        plan.save()
        return Response(combat_training_plan_payload(plan))

    def delete(self, request, pk):
        if request.user.role != User.Role.ADMIN:
            raise PermissionDenied("Планды администратор гана өчүрө алат.")
        self.get_object(pk).delete()
        return Response(status=204)


class CombatTrainingPlanUnreadCountView(APIView):
    permission_classes = [IsActiveUser]

    def get(self, request):
        if request.user.role == User.Role.ADMIN:
            return Response({"unreadCount": 0})

        try:
            read_at = request.user.combat_training_plan_read.read_at
        except CombatTrainingPlanRead.DoesNotExist:
            read_at = request.user.date_joined

        unread_count = CombatTrainingPlan.objects.filter(
            published_at__gt=read_at,
        ).count()
        return Response({"unreadCount": unread_count})


class CombatTrainingPlanReadAllView(APIView):
    permission_classes = [IsActiveUser]

    def post(self, request):
        if request.user.role != User.Role.ADMIN:
            CombatTrainingPlanRead.objects.update_or_create(user=request.user)
        return Response({"unreadCount": 0})
