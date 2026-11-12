import copy

from django.db import migrations


def copy_table(TrainingTable, source, target_period):
    if not source:
        return

    TrainingTable.objects.update_or_create(
        period=target_period,
        defaults={
            "title": source.title,
            "variant": source.variant,
            "columns": copy.deepcopy(source.columns),
            "rows": copy.deepcopy(source.rows),
            "header_fields": copy.deepcopy(source.header_fields),
            "header_rows": copy.deepcopy(source.header_rows),
            "is_active": True,
        },
    )


def restore_command_training_system_periods(apps, schema_editor):
    TrainingPeriod = apps.get_model("accounts", "TrainingPeriod")
    TrainingSection = apps.get_model("accounts", "TrainingSection")
    TrainingTable = apps.get_model("accounts", "TrainingTable")

    thematic_section = TrainingSection.objects.filter(slug="command-thematic-account").first()
    if thematic_section:
        thematic_period, _ = TrainingPeriod.objects.update_or_create(
            section=thematic_section,
            slug="period-1",
            defaults={
                "created_by": None,
                "title": "20__-окуу жылынын 1 мезгилине",
                "order": 10,
                "is_active": True,
            },
        )
        thematic_source = (
            TrainingTable.objects.filter(
                period__section=thematic_section,
                period__slug="period-2",
            ).first()
            or TrainingTable.objects.filter(
                period__section__slug="thematic-account",
                period__slug="period-1",
            ).first()
        )
        copy_table(TrainingTable, thematic_source, thematic_period)

    schedule_section = TrainingSection.objects.filter(slug="command-lesson-schedule").first()
    if schedule_section:
        schedule_period, _ = TrainingPeriod.objects.update_or_create(
            section=schedule_section,
            slug="lesson-schedule-week-1",
            defaults={
                "created_by": None,
                "title": 'Сабактардын жүгүртмөсү "__________ "айынын 1 жумасы',
                "order": 10,
                "is_active": True,
            },
        )
        if not TrainingTable.objects.filter(period=schedule_period).exists():
            schedule_source = TrainingTable.objects.filter(
                period__section__slug="lesson-schedule",
                period__slug="lesson-schedule-week-1",
            ).first()
            copy_table(TrainingTable, schedule_source, schedule_period)


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0034_submissioneditrequest"),
    ]

    operations = [
        migrations.RunPython(
            restore_command_training_system_periods,
            migrations.RunPython.noop,
        ),
    ]
