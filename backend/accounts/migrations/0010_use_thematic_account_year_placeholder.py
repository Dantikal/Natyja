from django.db import migrations


THEMATIC_ACCOUNT_SECTION_SLUGS = ("thematic-account", "command-thematic-account")
THEMATIC_ACCOUNT_YEAR_TEXT = "2026-окуу жылынын"
THEMATIC_ACCOUNT_YEAR_PLACEHOLDER = "20__-окуу жылынын"


def use_thematic_account_year_placeholder(apps, schema_editor):
    TrainingPeriod = apps.get_model("accounts", "TrainingPeriod")
    TrainingTable = apps.get_model("accounts", "TrainingTable")

    periods = TrainingPeriod.objects.filter(
        section__slug__in=THEMATIC_ACCOUNT_SECTION_SLUGS,
        title__contains=THEMATIC_ACCOUNT_YEAR_TEXT,
    )
    for period in periods:
        period.title = period.title.replace(
            THEMATIC_ACCOUNT_YEAR_TEXT,
            THEMATIC_ACCOUNT_YEAR_PLACEHOLDER,
        )
        period.save(update_fields=["title"])

    tables = TrainingTable.objects.filter(
        period__section__slug__in=THEMATIC_ACCOUNT_SECTION_SLUGS,
        title__contains=THEMATIC_ACCOUNT_YEAR_TEXT,
    )
    for table in tables:
        table.title = table.title.replace(
            THEMATIC_ACCOUNT_YEAR_TEXT,
            THEMATIC_ACCOUNT_YEAR_PLACEHOLDER,
        )
        table.save(update_fields=["title"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0009_update_thematic_account_periods"),
    ]

    operations = [
        migrations.RunPython(
            use_thematic_account_year_placeholder,
            migrations.RunPython.noop,
        ),
    ]
