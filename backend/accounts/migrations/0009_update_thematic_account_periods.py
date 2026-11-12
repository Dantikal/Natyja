import re

from django.db import migrations
from django.db.models import Q


THEMATIC_ACCOUNT_SECTION_SLUGS = ("thematic-account", "command-thematic-account")
REMOVED_THEMATIC_PERIOD_SLUGS = ("period-3", "period-4")
REMOVED_THEMATIC_PERIOD_TITLE_PARTS = (
    "2026-окуу жылынын 3 мезгилине",
    "2026-окуу жылынын 4 мезгилине",
    "20__-окуу жылынын 3 мезгилине",
    "20__-окуу жылынын 4 мезгилине",
)
THEMATIC_ACCOUNT_UNIT_TEXT = "2027 аскер бөлүгүнүн"
THEMATIC_ACCOUNT_YEAR_TEXT = "2026-окуу жылынын"
THEMATIC_ACCOUNT_YEAR_PLACEHOLDER = "20__-окуу жылынын"


def build_thematic_account_table_title(period_number):
    return (
        f"20__-окуу жылынын {period_number} мезгилине"
        '_______аскер бөлүгүнүн "__________" чек ара заставынын '
        "(тобунун, взвод, ротосынын) өздүк курамы  менен өтүлгүүчү   "
        "сабактардын тематикалык эсеп сааты."
    )


def normalize_thematic_account_title(title):
    raw_title = (
        (title or "")
        .replace(THEMATIC_ACCOUNT_YEAR_TEXT, THEMATIC_ACCOUNT_YEAR_PLACEHOLDER)
        .replace(THEMATIC_ACCOUNT_UNIT_TEXT, "")
    )
    compact_title = " ".join(raw_title.split())
    period_match = re.search(r"20__-окуу жылынын\s+(\d+)\s+мезгилине", compact_title)
    has_old_table_title = (
        "чек ара заставынын сержанттары" in compact_title
        or "командирдик даярдык боюнча сабактардын тематикалык эсеп сааты" in compact_title
    )
    if period_match and has_old_table_title:
        return build_thematic_account_table_title(period_match.group(1))
    if "өздүк курамы" in raw_title and "тематикалык эсеп сааты" in raw_title:
        return raw_title.strip()
    return compact_title


def update_thematic_account_periods(apps, schema_editor):
    TrainingSection = apps.get_model("accounts", "TrainingSection")
    TrainingPeriod = apps.get_model("accounts", "TrainingPeriod")
    TrainingTable = apps.get_model("accounts", "TrainingTable")

    thematic_sections = TrainingSection.objects.filter(
        slug__in=THEMATIC_ACCOUNT_SECTION_SLUGS
    )
    removal_filter = Q(slug__in=REMOVED_THEMATIC_PERIOD_SLUGS)
    for title_part in REMOVED_THEMATIC_PERIOD_TITLE_PARTS:
        removal_filter |= Q(title__contains=title_part)

    removed_periods = TrainingPeriod.objects.filter(
        section__in=thematic_sections
    ).filter(removal_filter)
    TrainingTable.objects.filter(period__in=removed_periods).update(is_active=False)
    removed_periods.update(is_active=False)

    for period in TrainingPeriod.objects.filter(section__in=thematic_sections):
        next_title = normalize_thematic_account_title(period.title)
        if next_title != period.title:
            period.title = next_title
            period.save(update_fields=["title"])

    for table in TrainingTable.objects.filter(period__section__in=thematic_sections):
        next_title = normalize_thematic_account_title(table.title)
        if next_title != table.title:
            table.title = next_title
            table.save(update_fields=["title"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0008_seed_command_training_library"),
    ]

    operations = [
        migrations.RunPython(update_thematic_account_periods, migrations.RunPython.noop),
    ]
