from django.db import migrations


def build_training_table(period_number):
    return {
        "title": (
            f"20__-окуу жылынын {period_number} мезгилине"
            '_______аскер бөлүгүнүн "__________" чек ара заставынын '
            "(тобунун, взвод, ротосынын) өздүк курамы  менен өтүлгүүчү   "
            "сабактардын тематикалык эсеп сааты."
        ),
        "columns": [
            {"key": "number", "label": "№"},
            {"key": "topic", "label": "Сабактардын аталышы"},
            {"key": "hours", "label": "канча саат"},
            {"key": "june", "label": "Июнь", "type": "datetime-local"},
            {"key": "july", "label": "Июль", "type": "datetime-local"},
            {"key": "august", "label": "Август", "type": "datetime-local"},
            {"key": "september", "label": "Сентябрь", "type": "datetime-local"},
        ],
        "rows": [
            {
                "number": number,
                "topic": "",
                "hours": "",
                "june": "",
                "july": "",
                "august": "",
                "september": "",
            }
            for number in range(1, 11)
        ],
    }


def build_lesson_schedule_period_title(week_number, month=""):
    if month:
        return f'Сабактардын жүгүртмөсү "{month} "айынын {week_number} жумасы'
    return f'Сабактардын жүгүртмөсү {week_number} жумасы'


def build_lesson_schedule_table(title=None):
    title = title or build_lesson_schedule_period_title(1)
    month_options = [
        "январь",
        "февраль",
        "март",
        "апрель",
        "май",
        "июнь",
        "июль",
        "август",
        "сентябрь",
        "октябрь",
        "ноябрь",
        "декабрь",
    ]
    day_groups = [
        {"id": "monday", "label": "Дүйшөмбү", "date": "20__ж. «__»____"},
        {"id": "tuesday", "label": "Шейшемби", "date": "20__ж. «__»____"},
        {"id": "wednesday", "label": "Шаршемби", "date": "20__ж. «__»____"},
        {"id": "thursday", "label": "Бейшемби", "date": "20__ж. «__»____"},
        {"id": "friday", "label": "Жума", "date": "20__ж. «__»____"},
        {"id": "saturday", "label": "Ишемби", "date": "20__ж. «__»____"},
        {"id": "sunday", "label": "Жекшемби", "date": "20__ж. «__»____"},
        {"id": "methodical", "label": "Методикалык нускамалоо", "date": "20__ж. «__»____"},
    ]
    columns = [
        {"key": "start_time", "label": "Башталуу убактысы", "type": "time"},
        {"key": "end_time", "label": "Аяктоо убактысы", "type": "time"},
        {"key": "activity", "label": "Өткөрүлүүчү иш-чара"},
    ]

    for group in day_groups:
        columns.extend(
            [
                {"key": f"{group['id']}_instructor", "label": "Ким өткөрөт"},
                {"key": f"{group['id']}_place", "label": "Өткөрүү орду"},
            ]
        )

    return {
        "title": title,
        "variant": "lesson-schedule",
        "header_fields": [
            {"key": "from_year", "label": "Башталган жыл", "defaultValue": "20__", "suffix": "-ж."},
            {"key": "from_day", "label": "Башталган күн", "defaultValue": "__", "prefix": "«", "suffix": "»"},
            {
                "key": "from_month",
                "label": "Башталган ай",
                "type": "select",
                "placeholder": "ай",
                "options": month_options,
            },
            {"text": "баштап"},
            {"key": "to_year", "label": "Аяктаган жыл", "defaultValue": "20__", "suffix": "-ж."},
            {"key": "to_day", "label": "Аяктаган күн", "defaultValue": "__", "prefix": "«", "suffix": "»"},
            {
                "key": "to_month",
                "label": "Аяктаган ай",
                "type": "select",
                "placeholder": "ай",
                "options": month_options,
            },
            {"text": "чейин"},
            {
                "key": "outpost",
                "label": "Чек ара заставасы",
                "defaultValue": "Степное",
                "suffix": "чек ара заставасы",
            },
        ],
        "header_rows": [
            [
                {"key": "start_time", "label": "Башталуу убактысы", "rowSpan": 3},
                {"key": "end_time", "label": "Аяктоо убактысы", "rowSpan": 3},
                {"key": "activity", "label": "Өткөрүлүүчү иш-чара", "rowSpan": 3},
                *[
                    {"key": group["id"], "label": group["label"], "colSpan": 2}
                    for group in day_groups
                ],
            ],
            [
                {
                    "key": f"{group['id']}_date",
                    "label": group["date"],
                    "defaultValue": group["date"],
                    "editableKey": f"{group['id']}_date",
                    "colSpan": 2,
                }
                for group in day_groups
            ],
            [
                cell
                for group in day_groups
                for cell in [
                    {"key": f"{group['id']}_instructor", "label": "Ким өткөрөт"},
                    {"key": f"{group['id']}_place", "label": "Өткөрүү орду"},
                ]
            ],
        ],
        "columns": columns,
        "rows": [
            {
                **{"start_time": "", "end_time": "", "activity": ""},
                **{
                    column["key"]: ""
                    for column in columns
                    if column["key"] not in {"start_time", "end_time", "activity"}
                },
            }
            for _ in range(10)
        ],
    }


def seed_command_training_library(apps, schema_editor):
    TrainingSection = apps.get_model("accounts", "TrainingSection")
    TrainingPeriod = apps.get_model("accounts", "TrainingPeriod")
    TrainingTable = apps.get_model("accounts", "TrainingTable")

    command_training, _ = TrainingSection.objects.update_or_create(
        slug="command-training",
        defaults={"title": "Командирдик даярдык", "order": 20, "is_active": True},
    )
    thematic, _ = TrainingSection.objects.update_or_create(
        slug="command-thematic-account",
        defaults={
            "title": "Сабактардын тематикалык эсеби",
            "parent": command_training,
            "order": 10,
            "is_active": True,
        },
    )
    lesson_schedule, _ = TrainingSection.objects.update_or_create(
        slug="command-lesson-schedule",
        defaults={
            "title": "Сабактардын жүгүртмөсү",
            "parent": command_training,
            "order": 20,
            "is_active": True,
        },
    )

    for period_number in (1, 2):
        table_data = build_training_table(period_number)
        period, _ = TrainingPeriod.objects.update_or_create(
            section=thematic,
            slug=f"period-{period_number}",
            defaults={
                "title": f"20__-окуу жылынын {period_number} мезгилине",
                "order": period_number * 10,
                "is_active": True,
            },
        )
        TrainingTable.objects.update_or_create(
            period=period,
            defaults={
                "title": table_data["title"],
                "columns": table_data["columns"],
                "rows": table_data["rows"],
                "header_fields": [],
                "header_rows": [],
                "is_active": True,
            },
        )

    table_data = build_lesson_schedule_table()
    period, _ = TrainingPeriod.objects.update_or_create(
        section=lesson_schedule,
        slug="lesson-schedule-week-1",
        defaults={"title": build_lesson_schedule_period_title(1), "order": 10, "is_active": True},
    )
    TrainingTable.objects.update_or_create(
        period=period,
        defaults={
            "title": table_data["title"],
            "variant": table_data["variant"],
            "columns": table_data["columns"],
            "rows": table_data["rows"],
            "header_fields": table_data["header_fields"],
            "header_rows": table_data["header_rows"],
            "is_active": True,
        },
    )


def unseed_command_training_library(apps, schema_editor):
    TrainingSection = apps.get_model("accounts", "TrainingSection")
    TrainingSection.objects.filter(
        slug__in=[
            "command-thematic-account",
            "command-lesson-schedule",
        ]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0007_methodicalmanualsubject"),
    ]

    operations = [
        migrations.RunPython(seed_command_training_library, unseed_command_training_library),
    ]
