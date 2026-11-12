from django.db import migrations


def build_combat_training_journal_table():
    return {
        "title": "Күжүрмөн даярдоону каттоо журналы",
        "columns": [
            {"key": "number", "label": "№"},
            {"key": "date", "label": "Дата", "type": "date"},
            {"key": "topic", "label": "Сабактын темасы"},
            {"key": "place", "label": "Өткөрүү орду"},
            {"key": "participants", "label": "Катышкандар"},
            {"key": "instructor", "label": "Жетекчи"},
            {"key": "note", "label": "Белги"},
        ],
        "rows": [
            {
                "number": number,
                "date": "",
                "topic": "",
                "place": "",
                "participants": "",
                "instructor": "",
                "note": "",
            }
            for number in range(1, 11)
        ],
    }


def seed_combat_training_journal(apps, schema_editor):
    TrainingSection = apps.get_model("accounts", "TrainingSection")
    TrainingPeriod = apps.get_model("accounts", "TrainingPeriod")
    TrainingTable = apps.get_model("accounts", "TrainingTable")

    section, _ = TrainingSection.objects.update_or_create(
        slug="combat-training-journal",
        defaults={
            "title": "Күжүрмөн даярдоону каттоо журналы",
            "order": 30,
            "is_active": True,
        },
    )
    period, _ = TrainingPeriod.objects.update_or_create(
        section=section,
        slug="combat-training-journal",
        defaults={
            "title": "Күжүрмөн даярдоону каттоо журналы",
            "order": 10,
            "is_active": True,
        },
    )
    table_data = build_combat_training_journal_table()
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


def unseed_combat_training_journal(apps, schema_editor):
    TrainingSection = apps.get_model("accounts", "TrainingSection")
    TrainingSection.objects.filter(slug="combat-training-journal").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0005_seed_training_library"),
    ]

    operations = [
        migrations.RunPython(seed_combat_training_journal, unseed_combat_training_journal),
    ]
