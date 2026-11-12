from django.db import migrations


def add_typical_week_section(apps, schema_editor):
    TrainingSection = apps.get_model("accounts", "TrainingSection")
    TrainingSection.objects.update_or_create(
        slug="typical-week",
        defaults={
            "title": "Типовая неделя",
            "parent": None,
            "order": 30,
            "is_active": True,
        },
    )


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0027_combat_training_news"),
    ]

    operations = [
        migrations.RunPython(
            add_typical_week_section,
            migrations.RunPython.noop,
        ),
    ]
