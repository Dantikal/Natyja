from django.db import migrations


LESSON_SCHEDULE_SECTION_SLUGS = ("lesson-schedule", "command-lesson-schedule")


def build_lesson_schedule_period_title(week_number, month="__________"):
    return f'Сабактардын жүгүртмөсү "{month} "айынын {week_number} жумасы'


def update_lesson_schedule_period_title(apps, schema_editor):
    TrainingPeriod = apps.get_model("accounts", "TrainingPeriod")
    TrainingTable = apps.get_model("accounts", "TrainingTable")

    periods = TrainingPeriod.objects.filter(
        section__slug__in=LESSON_SCHEDULE_SECTION_SLUGS,
        slug="lesson-schedule-week-1",
    )
    title = build_lesson_schedule_period_title(1)

    periods.update(title=title)
    TrainingTable.objects.filter(period__in=periods).update(title=title)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0012_update_lesson_schedule_period_title"),
    ]

    operations = [
        migrations.CreateModel(
            name="LessonSchedulePeriod",
            fields=[],
            options={
                "verbose_name": "Сабактардын жүгүртмөсү",
                "verbose_name_plural": "Сабактардын жүгүртмөсү",
                "proxy": True,
                "indexes": [],
                "constraints": [],
            },
            bases=("accounts.trainingperiod",),
        ),
        migrations.RunPython(
            update_lesson_schedule_period_title,
            migrations.RunPython.noop,
        ),
    ]
