from django.db import OperationalError, ProgrammingError
from django.db.models import Case, IntegerField, Value, When

from methodical.constants import NORMATIVE_LEGAL_ACTS_TITLE
from methodical.models import MethodicalManualSubject
from methodical.serializers import MethodicalManualSubjectSerializer


def methodical_manual_subject_queryset(
    collection=MethodicalManualSubject.Collection.METHODICAL_MANUALS,
):
    return (
        MethodicalManualSubject.objects.filter(
            is_active=True,
            collection=collection,
        )
        .annotate(
            menu_priority=Case(
                When(title=NORMATIVE_LEGAL_ACTS_TITLE, then=Value(0)),
                default=Value(1),
                output_field=IntegerField(),
            )
        )
        .order_by("menu_priority", "order", "title")
    )


def methodical_manual_subjects_payload():
    try:
        subjects = methodical_manual_subject_queryset()
        return MethodicalManualSubjectSerializer(subjects, many=True).data
    except (OperationalError, ProgrammingError):
        return []
