from django.db import transaction
from django.utils import timezone
from journals.subject_archive import subject_has_documents
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.unit_routing import regional_user_filter
from accounts.outposts import format_outpost_name
from accounts.permissions import IsActiveUser, IsPrimaryAdmin
from journals.models import CombatTrainingJournal, CombatTrainingJournalSubject
from journals.serializers import (
    CombatTrainingJournalSerializer,
    CombatTrainingJournalSubjectSerializer,
)


class CombatTrainingJournalListCreateView(APIView):
    permission_classes = [IsActiveUser]

    def get_queryset(self, request):
        queryset = CombatTrainingJournal.objects.all().order_by("-created_at", "-id")
        scope = request.query_params.get("scope")
        if scope:
            if request.user.role == User.Role.ADMIN:
                queryset = (
                    queryset.filter(scope__endswith=":command-training")
                    if scope.endswith(":command-training")
                    else queryset.exclude(scope__endswith=":command-training")
                )
            else:
                global_scope = (
                    "всей системы:command-training"
                    if scope.endswith(":command-training")
                    else "всей системы"
                )
                queryset = queryset.filter(Q(scope=scope) | Q(scope=global_scope))
        return queryset

    def get(self, request):
        serializer = CombatTrainingJournalSerializer(
            self.get_queryset(request),
            many=True,
        )
        return Response(serializer.data)

    def post(self, request):
        serializer = CombatTrainingJournalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = dict(serializer.validated_data)
        storage_id = payload.pop("storage_id")
        journal, created = CombatTrainingJournal.objects.update_or_create(
            storage_id=storage_id,
            defaults={
                **payload,
                "owner": request.user,
            },
        )
        return Response(
            CombatTrainingJournalSerializer(journal).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class CombatTrainingJournalSubjectListCreateView(APIView):
    permission_classes = [IsActiveUser]

    def get(self, request):
        deleted = request.query_params.get("deleted") == "1"
        if deleted and request.user.role != User.Role.ADMIN:
            raise PermissionDenied("Deleted subjects are available only to administrators.")
        subjects = CombatTrainingJournalSubject.objects.filter(is_active=not deleted)
        if deleted:
            subjects = subjects.order_by('-deleted_at','-id')
        if request.user.role == User.Role.ADMIN:
            unit_number = str(request.query_params.get("unitNumber") or "").strip()
            if unit_number:
                subjects = subjects.filter(unit_number=unit_number)
        else:
            if not request.user.region:
                return Response([])
            subjects = subjects.filter(unit_number=request.user.region)
        result=CombatTrainingJournalSubjectSerializer(subjects, many=True).data
        if deleted:
            for item,subject in zip(result,subjects):
                item['hasDocuments']=subject_has_documents(subject)
        return Response(result)

    def post(self, request):
        if not request.user.is_superuser:
            raise PermissionDenied("Добавлять предметы может только главный администратор.")
        serializer = CombatTrainingJournalSubjectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        subject = serializer.save()
        return Response(
            CombatTrainingJournalSubjectSerializer(subject).data,
            status=status.HTTP_201_CREATED,
        )


class CombatTrainingJournalSubjectDetailView(APIView):
    permission_classes = [IsPrimaryAdmin]

    def get_object(self, pk):
        return get_object_or_404(CombatTrainingJournalSubject, pk=pk)

    def patch(self, request, pk):
        subject = self.get_object(pk)
        if request.data.get('restore') is True:
            subject.is_active=True;subject.deleted_at=None;subject.deleted_by_name=''
            subject.save(update_fields=['is_active','deleted_at','deleted_by_name','updated_at'])
            return Response(CombatTrainingJournalSubjectSerializer(subject).data)
        serializer = CombatTrainingJournalSubjectSerializer(
            subject,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        subject = serializer.save()
        return Response(CombatTrainingJournalSubjectSerializer(subject).data)

    @transaction.atomic
    def delete(self, request, pk):
        subject=get_object_or_404(CombatTrainingJournalSubject.objects.select_for_update(),pk=pk)
        if request.query_params.get('permanent') == '1':
            if subject.is_active:
                raise ValidationError('First move the subject to the archive.')
            if subject_has_documents(subject):
                raise ValidationError('Предмет содержит документы. Окончательное удаление запрещено.')
            subject.delete()
        elif subject.is_active:
            subject.is_active=False
            subject.deleted_at=timezone.now()
            subject.deleted_by_name=request.user.full_name or request.user.email
            subject.save(update_fields=['is_active','deleted_at','deleted_by_name','updated_at'])
        return Response(status=204)


class CombatTrainingJournalOutpostListView(APIView):
    permission_classes = [IsActiveUser]

    def get(self, request):
        if request.user.role not in {User.Role.REGIONAL, User.Role.ADMIN} and request.user.unit_type != User.UnitType.TRAINING_CENTER_HEAD:
            raise PermissionDenied("Нет доступа к списку застав.")

        outposts = User.objects.filter(
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
        ).exclude(outpost_name="")
        if request.user.role == User.Role.REGIONAL or request.user.unit_type == User.UnitType.TRAINING_CENTER_HEAD:
            outposts = outposts.filter(regional_user_filter(request.user))

        result = []
        seen = set()
        for outpost in outposts.order_by("region", "outpost_name", "id"):
            key = (outpost.region, outpost.outpost_name if outpost.unit_type in {User.UnitType.TRAINING_CENTER_HEAD, User.UnitType.TRAINING_PLATOON_COMMANDER} else format_outpost_name(outpost.outpost_name))
            if key in seen:
                continue
            seen.add(key)
            result.append({
                "id": outpost.id,
                "name": key[1],
                "unitType": outpost.unit_type,
                "unitNumber": outpost.region,
            })
        return Response(result)


class CombatTrainingJournalDetailView(APIView):
    permission_classes = [IsActiveUser]

    def get_object(self, pk):
        return get_object_or_404(CombatTrainingJournal, pk=pk)

    def patch(self, request, pk):
        journal = self.get_object(pk)
        if request.user.role != User.Role.ADMIN and journal.owner_id != request.user.id:
            raise PermissionDenied("Можно изменить только свой журнал.")
        serializer = CombatTrainingJournalSerializer(
            journal,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        journal = serializer.save()
        return Response(CombatTrainingJournalSerializer(journal).data)

    def delete(self, request, pk):
        journal = self.get_object(pk)
        if request.user.role != User.Role.ADMIN and journal.owner_id != request.user.id:
            raise PermissionDenied("Можно удалить только свой журнал.")
        journal.delete()
        return Response(status=204)
