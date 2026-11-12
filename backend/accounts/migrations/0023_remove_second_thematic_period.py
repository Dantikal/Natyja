from django.db import migrations


THEMATIC_ACCOUNT_SECTION_SLUGS = (
    "thematic-account",
    "command-thematic-account",
)


def remove_second_thematic_period(apps, schema_editor):
    TrainingPeriod = apps.get_model("accounts", "TrainingPeriod")
    TrainingTable = apps.get_model("accounts", "TrainingTable")

    periods = TrainingPeriod.objects.filter(
        section__slug__in=THEMATIC_ACCOUNT_SECTION_SLUGS,
        slug="period-2",
    )
    TrainingTable.objects.filter(period__in=periods).update(is_active=False)
    periods.update(is_active=False)


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0022_methodicalmanualdocument"),
    ]

    operations = [
        migrations.RunPython(
            remove_second_thematic_period,
            migrations.RunPython.noop,
        ),
    ]
