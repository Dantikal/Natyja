import copy

from django.db import transaction
from django.db.models import Max
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsActiveUser
from training.constants import LESSON_SCHEDULE_SECTION_SLUGS, THEMATIC_ACCOUNT_SECTION_SLUGS
from training.models import TrainingPeriod, TrainingSection, TrainingTable
from training.serializers import library_period_payload
from training.services import build_lesson_schedule_period_title


class LessonSchedulePeriodListCreateView(APIView):
    permission_classes = [IsActiveUser]

    def post(self, request):
        section_slug = request.data.get("section") or request.data.get("sectionId")

        if section_slug not in LESSON_SCHEDULE_SECTION_SLUGS:
            return Response(
                {"section": "Укажите раздел Сабактардын жүгүртмөсү."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        title = str(request.data.get("title") or "").strip()
        if not title:
            week_number = str(request.data.get("weekNumber") or "1").strip() or "1"
            title = build_lesson_schedule_period_title(week_number)

        section = get_object_or_404(
            TrainingSection,
            slug=section_slug,
            is_active=True,
        )
        template_period = (
            TrainingPeriod.objects.filter(section=section, is_active=True)
            .select_related("table")
            .order_by("order", "title")
            .first()
        )

        template_table = None
        if template_period:
            try:
                template_table = template_period.table
            except TrainingTable.DoesNotExist:
                template_table = None

        if not template_table:
            template_table = (
                TrainingTable.objects.filter(
                    variant=TrainingTable.Variant.LESSON_SCHEDULE,
                    is_active=True,
                )
                .order_by("period__section__slug", "period__order", "title")
                .first()
            )

        with transaction.atomic():
            max_order = (
                TrainingPeriod.objects.filter(section=section).aggregate(max_order=Max("order"))["max_order"]
                or 0
            )
            next_order = max_order + 10
            week_number = str(request.data.get("weekNumber") or next_order // 10).strip() or "1"
            base_slug = f"lesson-schedule-week-{week_number}"
            slug = base_slug
            suffix = 2

            while TrainingPeriod.objects.filter(section=section, slug=slug).exists():
                slug = f"{base_slug}-{suffix}"
                suffix += 1

            period = TrainingPeriod.objects.create(
                section=section,
                created_by=request.user,
                slug=slug,
                title=title,
                order=next_order,
                is_active=True,
            )
            table = TrainingTable.objects.create(
                period=period,
                title=title,
                variant=template_table.variant if template_table else TrainingTable.Variant.LESSON_SCHEDULE,
                columns=copy.deepcopy(template_table.columns) if template_table else [],
                rows=copy.deepcopy(template_table.rows) if template_table else [],
                header_fields=copy.deepcopy(template_table.header_fields) if template_table else [],
                header_rows=copy.deepcopy(template_table.header_rows) if template_table else [],
                is_active=True,
            )

        return Response(
            {
                "id": period.slug,
                "title": period.title,
                "table": table.to_payload(),
                "canDelete": True,
            },
            status=status.HTTP_201_CREATED,
        )


class LessonSchedulePeriodDetailView(APIView):
    permission_classes = [IsActiveUser]

    def delete(self, request, section_slug, period_slug):
        if section_slug not in LESSON_SCHEDULE_SECTION_SLUGS:
            raise ValidationError({"section": "Укажите раздел Сабактардын жүгүртмөсү."})

        period = get_object_or_404(
            TrainingPeriod,
            section__slug=section_slug,
            slug=period_slug,
        )
        is_legacy_custom_period = (
            period.created_by_id is None
            and period.slug != "lesson-schedule-week-1"
        )
        can_delete = (
            request.user.role == User.Role.ADMIN
            or period.created_by_id == request.user.id
            or (request.user.role == User.Role.OUTPOST and is_legacy_custom_period)
        )
        if not can_delete:
            raise PermissionDenied("Можно удалить только добавленную вами неделю.")

        period.delete()
        return Response(status=204)


class LibraryPeriodListCreateView(APIView):
    permission_classes = [IsActiveUser]

    def post(self, request):
        section_slug = str(request.data.get("section") or request.data.get("sectionId") or "").strip()
        title = str(request.data.get("title") or "").strip()
        if not title:
            raise ValidationError({"title": "Укажите название документа."})

        section = get_object_or_404(TrainingSection, slug=section_slug, is_active=True)
        if (
            request.user.role != User.Role.ADMIN
            and section.slug not in THEMATIC_ACCOUNT_SECTION_SLUGS
        ):
            raise PermissionDenied("Нет права создавать документы в этом разделе.")
        template_period = (
            TrainingPeriod.objects.filter(section=section, is_active=True)
            .select_related("table")
            .order_by("order", "title")
            .first()
        )
        requested_table = request.data.get("table")

        with transaction.atomic():
            max_order = (
                TrainingPeriod.objects.filter(section=section).aggregate(max_order=Max("order"))["max_order"]
                or 0
            )
            base_slug = f"user-document-{request.user.id}"
            suffix = TrainingPeriod.objects.filter(section=section).count() + 1
            slug = f"{base_slug}-{suffix}"
            while TrainingPeriod.objects.filter(section=section, slug=slug).exists():
                suffix += 1
                slug = f"{base_slug}-{suffix}"

            period = TrainingPeriod.objects.create(
                section=section,
                created_by=request.user,
                slug=slug,
                title=title,
                order=max_order + 10,
                is_active=True,
            )

            template_table = None
            if template_period:
                try:
                    template_table = template_period.table
                except TrainingTable.DoesNotExist:
                    template_table = None

            if template_table is None and section.slug in LESSON_SCHEDULE_SECTION_SLUGS:
                template_table = (
                    TrainingTable.objects.filter(
                        variant=TrainingTable.Variant.LESSON_SCHEDULE,
                        is_active=True,
                    )
                    .order_by("period__section__slug", "period__order")
                    .first()
                )
            elif template_table is None and section.slug in THEMATIC_ACCOUNT_SECTION_SLUGS:
                template_table = (
                    TrainingTable.objects.filter(
                        period__section__slug__in=THEMATIC_ACCOUNT_SECTION_SLUGS,
                        is_active=True,
                    )
                    .order_by("period__section__slug", "period__order")
                    .first()
                )

            table_data = requested_table if isinstance(requested_table, dict) else {}
            if template_table or table_data:
                TrainingTable.objects.create(
                    period=period,
                    title=title,
                    variant=table_data.get("variant", template_table.variant if template_table else ""),
                    columns=copy.deepcopy(table_data.get("columns", template_table.columns if template_table else [])),
                    rows=copy.deepcopy(table_data.get("rows", template_table.rows if template_table else [])),
                    header_fields=copy.deepcopy(
                        table_data.get("headerFields", template_table.header_fields if template_table else [])
                    ),
                    header_rows=copy.deepcopy(
                        table_data.get("headerRows", template_table.header_rows if template_table else [])
                    ),
                    is_active=True,
                )

        return Response(library_period_payload(period), status=status.HTTP_201_CREATED)


class LibraryPeriodDetailView(APIView):
    permission_classes = [IsActiveUser]

    def get_object(self, section_slug, period_slug):
        period = get_object_or_404(
            TrainingPeriod,
            section__slug=section_slug,
            slug=period_slug,
        )
        if (
            self.request.user.role != User.Role.ADMIN
            and period.created_by_id != self.request.user.id
        ):
            raise PermissionDenied("Можно изменять только созданные вами документы.")
        return period

    def patch(self, request, section_slug, period_slug):
        period = self.get_object(section_slug, period_slug)
        title = str(request.data.get("title") or "").strip()
        if not title:
            raise ValidationError({"title": "Укажите название документа."})

        with transaction.atomic():
            period.title = title
            period.save(update_fields=("title",))
            TrainingTable.objects.filter(period=period).update(title=title)
        period.refresh_from_db()
        return Response(library_period_payload(period))

    def delete(self, request, section_slug, period_slug):
        period = self.get_object(section_slug, period_slug)
        period.delete()
        return Response(status=204)
