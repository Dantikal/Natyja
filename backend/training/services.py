import copy
import re

from django.db import OperationalError, ProgrammingError
from django.db.models import Q

from accounts.models import User
from training.constants import (
    COMMAND_THEMATIC_ACCOUNT_SECTION_SLUG,
    LESSON_SCHEDULE_SECTION_SLUGS,
    LIBRARY_EXCLUDED_SECTION_SLUGS,
    REMOVED_THEMATIC_PERIOD_SLUGS,
    REMOVED_THEMATIC_PERIOD_TITLE_PARTS,
    THEMATIC_ACCOUNT_SECTION_SLUGS,
    THEMATIC_ACCOUNT_SECTION_TITLE,
    THEMATIC_ACCOUNT_UNIT_TEXT,
    THEMATIC_ACCOUNT_YEAR_PLACEHOLDER,
    THEMATIC_ACCOUNT_YEAR_TEXT,
)
from training.models import TrainingPeriod, TrainingSection, TrainingTable


def build_thematic_account_table_title(period_number):
    return (
        f"20__-окуу жылынын {period_number} мезгилине"
        '_______аскер бөлүгүнүн "__________" чек ара заставынын '
        "(тобунун, взвод, ротосынын) өздүк курамы  менен өтүлгүүчү   "
        "сабактардын тематикалык эсеп сааты."
    )


def build_command_thematic_account_table_title(period_number="___"):
    return (
        f'20__-окуу жылынын {period_number} мезгилине_______аскер бөлүгүнүн "__________" чек ара заставынын '
        "(тобунун, взвод, ротосынын) сержант,  прапорщиктердин\n"
        "өздүк курамы  менен өтүлгүүчү "
        "командирдик даярдык боюбнча  сабактардын тематикалык эсеп сааты."
    )


def build_lesson_schedule_period_title(week_number, month=""):
    if month:
        return f'Сабактардын жүгүртмөсү "{month} "айынын {week_number} жумасы'
    return f'Сабактардын жүгүртмөсү {week_number} жумасы'


def normalize_thematic_account_title(title, is_command=False, period_number=None):
    raw_title = (
        (title or "")
        .replace(THEMATIC_ACCOUNT_YEAR_TEXT, THEMATIC_ACCOUNT_YEAR_PLACEHOLDER)
        .replace(THEMATIC_ACCOUNT_UNIT_TEXT, "")
    )
    compact_title = " ".join(raw_title.split())
    period_match = re.search(r"20__-окуу жылынын\s+(\d+)\s+мезгилине", compact_title)
    command_period_number = period_number or (period_match.group(1) if period_match else "___")
    if is_command and "тематикалык эсеп сааты" in raw_title:
        return build_command_thematic_account_table_title(command_period_number)

    has_old_table_title = (
        "чек ара заставынын сержанттары" in compact_title
        or "командирдик даярдык боюнча сабактардын тематикалык эсеп сааты" in compact_title
    )
    if period_match and has_old_table_title:
        return build_thematic_account_table_title(period_match.group(1))
    if "өздүк курамы" in raw_title and "тематикалык эсеп сааты" in raw_title:
        return raw_title.strip()
    return compact_title


def get_period_number(period):
    slug_match = re.search(r"period-(\d+)$", period.slug or "")
    if slug_match:
        return slug_match.group(1)

    title_match = re.search(r"20__-окуу жылынын\s+(\d+)\s+мезгилине", period.title or "")
    return title_match.group(1) if title_match else None


def is_removed_thematic_period(period):
    if period.slug.startswith("admin-document-"):
        return False
    return period.slug in REMOVED_THEMATIC_PERIOD_SLUGS or any(
        title_part in period.title
        for title_part in REMOVED_THEMATIC_PERIOD_TITLE_PARTS
    )


def build_library_sections_from_db(user=None):
    try:
        sections = list(
            TrainingSection.objects.filter(is_active=True)
            .exclude(slug__in=LIBRARY_EXCLUDED_SECTION_SLUGS)
            .order_by(
                "parent_id", "order", "title"
            )
        )
        if not sections:
            return []

        section_ids = [section.id for section in sections]
        period_queryset = TrainingPeriod.objects.filter(
            is_active=True,
            section_id__in=section_ids,
        )
        if user and user.role != User.Role.ADMIN:
            period_queryset = period_queryset.filter(
                Q(created_by__isnull=True) | Q(created_by=user)
            )
        periods = list(
            period_queryset
            .select_related("table")
            .order_by("section_id", "order", "title")
        )
    except (OperationalError, ProgrammingError):
        return []

    children_by_parent = {}
    for section in sections:
        children_by_parent.setdefault(section.parent_id, []).append(section)

    periods_by_section = {}
    for period in periods:
        periods_by_section.setdefault(period.section_id, []).append(period)

    def serialize_section(section):
        is_thematic_account = section.slug in THEMATIC_ACCOUNT_SECTION_SLUGS
        is_command_thematic_account = section.slug == COMMAND_THEMATIC_ACCOUNT_SECTION_SLUG
        payload = {
            "id": section.slug,
            "title": (
                THEMATIC_ACCOUNT_SECTION_TITLE
                if is_thematic_account
                else section.title
            ),
        }

        child_sections = [
            serialize_section(child)
            for child in children_by_parent.get(section.id, [])
        ]
        if child_sections:
            payload["sections"] = child_sections

        section_periods = []
        for period in periods_by_section.get(section.id, []):
            period_number = get_period_number(period)
            if (
                is_thematic_account
                and is_removed_thematic_period(period)
            ):
                continue

            period_title = (
                normalize_thematic_account_title(
                    period.title,
                    is_command_thematic_account,
                    period_number,
                )
                if is_thematic_account
                else period.title
            )
            period_payload = {"id": period.slug, "title": period_title}
            if user and (
                user.role == User.Role.ADMIN
                or period.created_by_id == user.id
            ):
                period_payload["canEdit"] = True
                period_payload["canDelete"] = True
            is_legacy_custom_lesson_period = (
                period.section.slug in LESSON_SCHEDULE_SECTION_SLUGS
                and period.created_by_id is None
                and period.slug != "lesson-schedule-week-1"
            )
            if user and (
                (
                    period.created_by_id
                    and (user.role == User.Role.ADMIN or period.created_by_id == user.id)
                )
                or (
                    is_legacy_custom_lesson_period
                    and user.role in {User.Role.ADMIN, User.Role.OUTPOST}
                )
            ):
                period_payload["canDelete"] = True
            try:
                table = period.table
            except TrainingTable.DoesNotExist:
                table = None

            if table and table.is_active:
                table_payload = table.to_payload()
                if is_thematic_account:
                    table_payload["title"] = normalize_thematic_account_title(
                        table_payload.get("title"),
                        is_command_thematic_account,
                        period_number,
                    )
                period_payload["table"] = table_payload

            section_periods.append(period_payload)

        if section_periods:
            payload["periods"] = section_periods

        return payload

    return [
        serialize_section(section)
        for section in children_by_parent.get(None, [])
    ]


def add_regional_command_training_groups(sections):
    """Add the military-unit-specific command training hierarchy."""
    command_training = next(
        (section for section in sections if section.get("id") == "command-training"),
        None,
    )
    if not command_training:
        return sections

    command_training_sections = command_training.get("sections", [])
    command_training["sections"] = [
        {
            "id": "command-training-subunits",
            "title": "Бөлүкчөлөрдүн командирдик даярдоосу",
            "sections": copy.deepcopy(command_training_sections),
        },
        {
            "id": "command-training-military-unit",
            "title": "Аскер бөлүктүн командирдик даярдоосу",
            "sections": copy.deepcopy(command_training_sections),
        },
    ]
    return sections


def add_regional_typical_week_groups(sections):
    typical_week = next(
        (section for section in sections if section.get("id") == "typical-week"),
        None,
    )
    if not typical_week:
        return sections

    military_unit_content = {}
    if typical_week.get("periods"):
        military_unit_content["periods"] = copy.deepcopy(typical_week["periods"])
    if typical_week.get("table"):
        military_unit_content["table"] = copy.deepcopy(typical_week["table"])
    typical_week.pop("periods", None)
    typical_week.pop("table", None)
    typical_week["sections"] = [
        {
            "id": "typical-week-subunits",
            "title": "Бөлүкчөлөрдүн типтуу жумасы",
        },
        {
            "id": "typical-week-military-unit",
            "title": "Аскер бөлүктүн типтуу жумасы",
            **military_unit_content,
        },
    ]
    return sections


def build_training_table_module_from_db(section_slug, scope):
    try:
        section = TrainingSection.objects.filter(
            slug=section_slug,
            is_active=True,
        ).first()
        if not section:
            return None

        period = (
            TrainingPeriod.objects.filter(section=section, is_active=True)
            .select_related("table")
            .order_by("order", "title")
            .first()
        )
    except (OperationalError, ProgrammingError):
        return None

    if not period:
        return None

    try:
        table = period.table
    except TrainingTable.DoesNotExist:
        return None

    if not table.is_active:
        return None

    return {
        "id": section.slug,
        "title": section.title,
        "scope": scope,
        "table": table.to_payload(),
    }
