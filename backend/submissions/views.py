from submissions.serializers import thematic_submission_metadata
import copy
import re
import hashlib

from django.db import transaction
from django.db.models import Q, F
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.unit_routing import regional_submission_filter, is_submission_recipient
from accounts.permissions import IsActiveUser, IsAdminRole
from submissions.archive import archive_submission
from submissions.models import (
    CombatTrainingJournalRevision,
    CombatTrainingJournalRevisionHidden,
    CombatTrainingJournalRevisionRead,
    SubmissionEditRequest,
    SubmissionArchiveCopy,
    ThematicAccountSubmission,
    ThematicAccountSubmissionHidden,
    ThematicAccountSubmissionRead,
)
from submissions.serializers import submission_edit_request_payload, thematic_submission_payload
from training.constants import THEMATIC_ACCOUNT_SECTION_SLUGS
from training.models import TrainingPeriod


class SubmissionArchiveListView(APIView):
    permission_classes = [IsActiveUser]

    @transaction.atomic
    def post(self, request):
        if request.data.get("kind") != "annual-draft":
            raise ValidationError({"kind": "Expected an annual draft snapshot."})
        try:
            year = int(request.data.get("year"))
        except (ValueError, TypeError):
            raise ValidationError({"year": "Invalid reporting year."})
        if not 2000 <= year < timezone.localdate().year:
            raise ValidationError({"year": "Only completed years may be archived."})
        table = request.data.get("table")
        key = request.data.get("key")
        section = request.data.get("sectionId")
        annual_sections = {"thematic-account", "command-thematic-account", "lesson-schedule", "command-lesson-schedule", "typical-week"}
        if not isinstance(table, dict) or not isinstance(key, str) or not key or section not in annual_sections:
            raise ValidationError({"document": "Invalid annual draft."})
        User.objects.select_for_update().get(pk=request.user.pk)
        period = "annual-" + hashlib.sha256(key.encode()).hexdigest()
        item, created = SubmissionArchiveCopy.objects.get_or_create(
            sender_id_snapshot=request.user.pk, source_submission_id=0, year=year, period_slug=period,
            defaults={"sender_name": request.user.full_name or request.user.email,
                      "unit_number": request.user.region, "outpost_name": request.user.outpost_name,
                      "document_title": str(request.data.get("documentTitle") or "Annual report")[:255],
                      "section_slug": section, "table_data": table},
        )
        return Response({"id": item.pk, "year": item.year}, status=201 if created else 200)

    def get(self, request):
        section_ids = request.query_params.getlist("sectionId")
        copies = SubmissionArchiveCopy.objects.filter(sender_id_snapshot=request.user.id)
        admin_archive = request.query_params.get("scope") == "admin"
        if admin_archive:
            if request.user.role != User.Role.ADMIN:
                raise PermissionDenied("Архивди көрүүгө укук жок.")
            copies = SubmissionArchiveCopy.objects.all()
        if request.query_params.get("scope") == "unit":
            if request.user.role != User.Role.REGIONAL:
                raise PermissionDenied("Unit archive is unavailable.")
            copies = SubmissionArchiveCopy.objects.filter(unit_number=request.user.region).exclude(source_submission_id=0)
        unit_number=request.query_params.get("unitNumber")
        if unit_number:
            copies=copies.filter(unit_number=unit_number)
        if section_ids:
            copies = copies.filter(section_slug__in=section_ids)
        copy_id = request.query_params.get("copyId")
        if copy_id:
            if not copy_id.isdigit():
                raise ValidationError({"copyId": "Invalid archive id."})
            copies = copies.filter(pk=int(copy_id))
        paged = request.query_params.get("metadata") == "1"
        has_more = False
        if paged:
            try:
                limit = min(100, max(1, int(request.query_params.get("limit", "50"))))
                before = int(request.query_params.get("beforeId", "0"))
            except ValueError:
                raise ValidationError({"pagination": "Invalid archive cursor."})
            if before:
                copies = copies.filter(pk__lt=before)
            copies = copies.annotate(archive_analysis_type=F("table_data__sectionId")).defer("table_data").order_by("-pk")
            page = list(copies[:limit + 1])
            has_more = len(page) > limit
            copies = page[:limit]
        sender_roles = dict(User.objects.filter(
            id__in=[item.sender_id_snapshot for item in copies]
        ).values_list("id", "role")) if admin_archive else {}
        items = [
            {
                "id": copy.id,
                "sourceSubmissionId": copy.source_submission_id,
                "documentTitle": copy.document_title,
                "sectionId": copy.section_slug,
                "periodId": copy.period_slug,
                "table": {"sectionId": copy.archive_analysis_type} if paged else copy.table_data,
                "senderName": copy.sender_name,
                "senderRole": sender_roles.get(copy.sender_id_snapshot, ""),
                "unitNumber": copy.unit_number,
                "outpostName": copy.outpost_name,
                "year": copy.year,
                "archivedAt": copy.archived_at.isoformat(),
            }
            for copy in copies
        ]
        return Response({"results": items, "nextCursor": copies[-1].pk if has_more else None} if paged else items)


class ThematicAccountSubmissionListCreateView(APIView):
    permission_classes = [IsActiveUser]

    def get(self, request):
        submissions = ThematicAccountSubmission.objects.select_related("sender", "edit_request").prefetch_related(
            "reads",
            "revisions__reads",
            "revisions__hidden_by",
        )
        registration_number = str(
            request.query_params.get("registrationNumber") or ""
        ).strip()
        section_ids = [
            section_id.strip()
            for section_id in request.query_params.getlist("sectionId")
            if section_id.strip()
        ]
        sender_id = str(request.query_params.get("senderId") or "").strip()
        if registration_number:
            if request.user.role != User.Role.ADMIN:
                raise PermissionDenied("Каттоо номери боюнча издөөгө укук жок.")
            registration_match = re.search(r"(?:^|/)(\d+)$", registration_number)
            if not registration_match:
                raise ValidationError({"registrationNumber": "Каттоо номери туура эмес."})
            submissions = submissions.filter(pk=int(registration_match.group(1)))
            return Response([
                thematic_submission_payload(item, request.user)
                for item in submissions
            ])

        if section_ids:
            submissions = submissions.filter(section_slug__in=section_ids)
        if sender_id:
            if not sender_id.isdigit():
                raise ValidationError({"senderId": "Идентификатор отправителя указан неверно."})
            if request.user.role != User.Role.ADMIN and int(sender_id) != request.user.id:
                raise PermissionDenied("Нет права просматривать документы другого отправителя.")
            submissions = submissions.filter(sender_id=int(sender_id))

        if request.user.role == User.Role.OUTPOST:
            submissions = submissions.filter(
                Q(sender=request.user) | (Q(sender__training_center=request.user,
                    sender__unit_type=User.UnitType.TRAINING_PLATOON_COMMANDER)
                    if request.user.unit_type == User.UnitType.TRAINING_CENTER_HEAD else Q(pk__in=[]))
            )
        elif request.user.role == User.Role.REGIONAL:
            submissions = submissions.filter(
                regional_submission_filter(request.user) | Q(sender=request.user)
            )
        elif request.user.role == User.Role.ADMIN:
            # Administrators audit the complete document flow, including memo
            # letters sent by outposts to their regional military units.
            pass
        elif request.user.role != User.Role.ADMIN:
            raise PermissionDenied("Нет доступа к отправленным документам.")

        submissions = submissions.exclude(hidden_by__user=request.user)
        document_id = request.query_params.get("submissionId")
        if document_id:
            if not str(document_id).isdigit():
                raise ValidationError({"submissionId": "Invalid document ID."})
            submissions = submissions.filter(pk=int(document_id))
        metadata = request.query_params.get("metadata") == "1"
        serialize = thematic_submission_metadata if metadata else thematic_submission_payload
        if metadata:
            submissions = submissions.defer("table_data").prefetch_related(None).prefetch_related("reads")


        if request.query_params.get("paged") == "1":
            try:
                before = int(request.query_params.get("beforeId", "0"))
                limit = min(50, max(1, int(request.query_params.get("limit", "25"))))
            except ValueError:
                raise ValidationError({"pagination": "Invalid document cursor."})
            if before:
                submissions = submissions.filter(pk__lt=before)
            page = list(submissions.order_by("-pk")[:limit + 1])
            has_more = len(page) > limit
            page = page[:limit]
            return Response({
                "results": [serialize(item, request.user) for item in page],
                "nextCursor": page[-1].pk if has_more else None,
            })

        return Response([
            serialize(item, request.user)
            for item in submissions
        ])

    @transaction.atomic
    def post(self, request):
        document_title = str(request.data.get("documentTitle") or "").strip()
        section_slug = str(request.data.get("sectionId") or "").strip()
        period_slug = str(request.data.get("periodId") or "").strip()
        table_data = request.data.get("table")

        can_submit = request.user.role in {User.Role.OUTPOST, User.Role.REGIONAL}
        if not can_submit:
            raise PermissionDenied("Бул документти жөнөтүүгө укук жок.")

        errors = {}
        if not document_title:
            errors["documentTitle"] = "Иш кагаздардын аталышын жазыңыз."
        if section_slug not in {
            "thematic-account",
            "lesson-schedule",
            "command-thematic-account",
            "command-lesson-schedule",
            "typical-week",
            "combat-training-personnel-journal",
            "combat-training-command-journal",
            "combat-training-results-observation",
            "combat-training-results-inspection",
            "combat-training-analysis",
            "combat-training-analysis-regional",
            "meetings-thematic-account",
            "meetings-lesson-schedule",
            "meetings-combat-training-journal",
            "meetings-observation",
            "meetings-analysis",
            "young-soldier-thematic-account",
            "young-soldier-lesson-schedule",
            "young-soldier-combat-training-journal",
            "young-soldier-observation",
            "young-soldier-analysis",
            "memo-letter",
            "shooting-statements",
        }:
            errors["sectionId"] = "Отправляемый раздел указан неверно."
        if not request.user.region:
            errors["unitNumber"] = "Аскер бөлүгүнүн номери көрсөтүлгөн эмес."
        if not isinstance(table_data, dict):
            errors["table"] = "Таблицанын маалыматы туура эмес."
        if errors:
            raise ValidationError(errors)

        submission_defaults = {
            "unit_number": request.user.region,
            "outpost_name": request.user.outpost_name,
            "document_title": document_title,
            "table_data": table_data,
        }
        if section_slug == "combat-training-results-observation":
            subject_id = str(table_data.get("subjectId") or "").strip()
            if not subject_id:
                raise ValidationError({"table": "Предмет көрсөтүлгөн эмес."})

            submission = ThematicAccountSubmission.objects.filter(
                sender=request.user,
                section_slug=section_slug,
                document_title=document_title,
            ).first()
            created = submission is None
            grouped_table_data = dict(submission.table_data or {}) if submission else {}
            grouped_subjects = dict(grouped_table_data.get("subjects") or {})
            grouped_subjects[subject_id] = table_data
            grouped_table_data["subjects"] = grouped_subjects
            submission_defaults["table_data"] = grouped_table_data

            if submission:
                for field, value in submission_defaults.items():
                    setattr(submission, field, value)
                submission.save(update_fields=[*submission_defaults.keys(), "updated_at"])
            else:
                submission = ThematicAccountSubmission.objects.create(
                    sender=request.user,
                    section_slug=section_slug,
                    period_slug="",
                    **submission_defaults,
                )
        elif section_slug in {
            "combat-training-personnel-journal",
            "combat-training-command-journal",
            "meetings-combat-training-journal",
            "young-soldier-combat-training-journal",
        }:
            submission = ThematicAccountSubmission.objects.filter(
                sender=request.user,
                section_slug=section_slug,
                period_slug=period_slug,
            ).first()
            created = submission is None
            if submission:
                for field, value in submission_defaults.items():
                    setattr(submission, field, value)
                submission.save(update_fields=[*submission_defaults.keys(), "updated_at"])
            else:
                submission = ThematicAccountSubmission.objects.create(
                    sender=request.user,
                    section_slug=section_slug,
                    period_slug=period_slug,
                    **submission_defaults,
                )
        else:
            submission = ThematicAccountSubmission.objects.create(
                sender=request.user,
                section_slug=section_slug,
                period_slug=period_slug,
                **submission_defaults,
            )
            created = True
        if section_slug in {
            "combat-training-personnel-journal",
            "combat-training-command-journal",
            "meetings-combat-training-journal",
            "young-soldier-combat-training-journal",
        }:
            CombatTrainingJournalRevision.objects.create(
                submission=submission,
                document_title=document_title,
                table_data=copy.deepcopy(table_data),
            )
        archive_submission(submission)
        if section_slug in THEMATIC_ACCOUNT_SECTION_SLUGS and period_slug:
            TrainingPeriod.objects.filter(
                section__slug=section_slug,
                slug=period_slug,
                created_by=request.user,
            ).delete()
        return Response(
            thematic_submission_payload(submission, request.user),
            status=201 if created else 200,
        )


class ThematicAccountSubmissionDetailView(APIView):
    permission_classes = [IsActiveUser]

    @transaction.atomic
    def patch(self, request, pk):
        submission = get_object_or_404(
            ThematicAccountSubmission.objects.select_related("sender").prefetch_related("reads"),
            pk=pk,
        )
        is_sender = (
            request.user.role in {User.Role.OUTPOST, User.Role.REGIONAL}
            and submission.sender_id == request.user.id
        )
        approved_edit_request = SubmissionEditRequest.objects.filter(
            submission=submission,
            requester=request.user,
            status=SubmissionEditRequest.Status.APPROVED,
        ).first()
        if is_sender and approved_edit_request:
            table_data = request.data.get("table")
            document_title = str(
                request.data.get("documentTitle") or submission.document_title
            ).strip()
            errors = {}
            if not document_title:
                errors["documentTitle"] = "Укажите название документа."
            if not isinstance(table_data, dict):
                errors["table"] = "Данные таблицы указаны неверно."
            if errors:
                raise ValidationError(errors)

            submission.document_title = document_title
            submission.table_data = table_data
            submission.is_corrected = True
            submission.save(
                update_fields=("document_title", "table_data", "is_corrected", "updated_at")
            )
            archive_submission(submission)
            submission.reads.all().delete()
            approved_edit_request.status = SubmissionEditRequest.Status.CORRECTED
            approved_edit_request.save(update_fields=("status", "updated_at"))
            submission._prefetched_objects_cache.pop("reads", None)
            return Response(thematic_submission_payload(submission, request.user))

        is_matching_regional_unit = (
            is_submission_recipient(request.user, submission)
        )
        is_admin_recipient = (
            request.user.role == User.Role.ADMIN
            and (submission.sender.role == User.Role.REGIONAL or submission.section_slug == "memo-letter")
        )
        if not (is_matching_regional_unit or is_admin_recipient):
            raise PermissionDenied("Нет права отмечать этот документ прочитанным.")

        ThematicAccountSubmissionRead.objects.get_or_create(
            submission=submission,
            user=request.user,
        )
        submission._prefetched_objects_cache.pop("reads", None)
        return Response(thematic_submission_payload(submission, request.user))

    def delete(self, request, pk):
        submission = get_object_or_404(
            ThematicAccountSubmission.objects.select_related("sender"),
            pk=pk,
        )
        is_sender = (
            request.user.role in {User.Role.OUTPOST, User.Role.REGIONAL}
            and submission.sender_id == request.user.id
        )
        is_matching_regional_unit = (
            is_submission_recipient(request.user, submission)
        )
        is_admin = request.user.role == User.Role.ADMIN
        if not (is_sender or is_matching_regional_unit or is_admin):
            raise PermissionDenied("Нет права удалять этот отправленный документ.")

        subject_id = str(request.query_params.get("subjectId") or "").strip()
        if subject_id and submission.section_slug == "combat-training-results-observation":
            table_data = dict(submission.table_data or {})
            subjects = dict(table_data.get("subjects") or {})
            subjects.pop(subject_id, None)
            if subjects:
                table_data["subjects"] = subjects
                submission.table_data = table_data
                submission.save(update_fields=["table_data"])
                return Response(thematic_submission_payload(submission))

        submission.delete()
        return Response(status=204)


class ThematicAccountSubmissionHideView(APIView):
    permission_classes = [IsActiveUser]

    def post(self, request, pk):
        submission = get_object_or_404(ThematicAccountSubmission, pk=pk)
        if (
            request.user.role not in {User.Role.OUTPOST, User.Role.REGIONAL}
            or submission.sender_id != request.user.id
        ):
            raise PermissionDenied("Өзүңүз жөнөткөн документти гана тизмеден өчүрө аласыз.")

        ThematicAccountSubmissionHidden.objects.get_or_create(
            submission=submission,
            user=request.user,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class CombatTrainingJournalRevisionDetailView(APIView):
    permission_classes = [IsActiveUser]

    def patch(self, request, pk):
        revision = get_object_or_404(
            CombatTrainingJournalRevision.objects.select_related("submission__sender"),
            pk=pk,
        )
        submission = revision.submission
        is_matching_regional_unit = (
            is_submission_recipient(request.user, submission)
        )
        if not is_matching_regional_unit:
            raise PermissionDenied("Нет права отмечать это обновление прочитанным.")

        CombatTrainingJournalRevisionRead.objects.get_or_create(
            revision=revision,
            user=request.user,
        )
        return Response({"id": revision.id, "isRead": True})

    def delete(self, request, pk):
        revision = get_object_or_404(
            CombatTrainingJournalRevision.objects.select_related("submission__sender"),
            pk=pk,
        )
        submission = revision.submission
        is_sender = submission.sender_id == request.user.id
        is_matching_regional_unit = (
            is_submission_recipient(request.user, submission)
        )
        is_admin = request.user.role == User.Role.ADMIN
        if not (is_sender or is_matching_regional_unit or is_admin):
            raise PermissionDenied("Нет права удалять это обновление журнала.")

        CombatTrainingJournalRevisionHidden.objects.get_or_create(
            revision=revision,
            user=request.user,
        )
        return Response(status=204)


class ThematicAccountSubmissionForwardView(APIView):
    permission_classes = [IsActiveUser]

    @transaction.atomic
    def post(self, request, pk):
        if request.user.role != User.Role.REGIONAL and request.user.unit_type != User.UnitType.TRAINING_CENTER_HEAD:
            raise PermissionDenied("Бул документти жөнөтүүгө укук жок.")

        source = get_object_or_404(
            ThematicAccountSubmission.objects.select_related("sender"),
            pk=pk,
        )
        if not is_submission_recipient(request.user, source):
            raise PermissionDenied("Бул кириш документти жөнөтүүгө укук жок.")

        document_title = str(request.data.get("documentTitle") or "").strip()
        if not document_title:
            raise ValidationError({"documentTitle": "Иш кагаздардын аталышын жазыңыз."})

        forwarded = ThematicAccountSubmission.objects.create(
            sender=request.user,
            unit_number=request.user.region,
            outpost_name=request.user.outpost_name if request.user.unit_type == User.UnitType.TRAINING_CENTER_HEAD else "",
            document_title=document_title,
            section_slug=source.section_slug,
            period_slug=source.period_slug,
            table_data=copy.deepcopy(source.table_data),
        )
        if source.section_slug in {
            "combat-training-personnel-journal",
            "combat-training-command-journal",
            "young-soldier-combat-training-journal",
        }:
            CombatTrainingJournalRevision.objects.bulk_create([
                CombatTrainingJournalRevision(
                    submission=forwarded,
                    document_title=revision.document_title,
                    table_data=copy.deepcopy(revision.table_data),
                )
                for revision in source.revisions.all()
            ])

        archive_submission(forwarded)

        return Response(
            thematic_submission_payload(forwarded, request.user),
            status=status.HTTP_201_CREATED,
        )


class SubmissionEditRequestCreateView(APIView):
    permission_classes = [IsActiveUser]

    def post(self, request, pk):
        submission = get_object_or_404(ThematicAccountSubmission, pk=pk)
        if request.user.role not in {User.Role.OUTPOST, User.Role.REGIONAL} or submission.sender_id != request.user.id:
            raise PermissionDenied("Өзүңүз жөнөткөн документке гана уруксат сурай аласыз.")

        edit_request, _ = SubmissionEditRequest.objects.get_or_create(
            submission=submission,
            defaults={"requester": request.user},
        )
        edit_request.requester = request.user
        edit_request.status = SubmissionEditRequest.Status.PENDING
        edit_request.reviewed_at = None
        edit_request.reviewed_by = None
        edit_request.save()
        return Response(submission_edit_request_payload(edit_request), status=status.HTTP_201_CREATED)


class SubmissionEditRequestListView(APIView):
    permission_classes = [IsActiveUser, IsAdminRole]

    def get(self, request):
        items = SubmissionEditRequest.objects.select_related("requester", "submission", "submission__sender")
        return Response([submission_edit_request_payload(item) for item in items])


class SubmissionEditRequestDecisionView(APIView):
    permission_classes = [IsActiveUser, IsAdminRole]

    def patch(self, request, pk):
        item = get_object_or_404(
            SubmissionEditRequest.objects.select_related("requester", "submission", "submission__sender"),
            pk=pk,
        )
        decision = str(request.data.get("status") or "").strip()
        if decision not in {SubmissionEditRequest.Status.APPROVED, SubmissionEditRequest.Status.REJECTED}:
            raise ValidationError({"status": "Разрешить же Отклонить маанисин тандаңыз."})
        item.status = decision
        item.reviewed_by = request.user
        item.reviewed_at = timezone.now()
        item.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])
        return Response(submission_edit_request_payload(item))

    def delete(self, request, pk):
        item = get_object_or_404(SubmissionEditRequest, pk=pk)
        if item.status == SubmissionEditRequest.Status.PENDING:
            raise ValidationError({"detail": "Адегенде сурамга уруксат бериңиз же четке кагыңыз."})
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

