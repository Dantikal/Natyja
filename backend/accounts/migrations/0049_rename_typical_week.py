from django.db import migrations


def rename_typical_week(apps, schema_editor):
    training_section_model = apps.get_model("accounts", "TrainingSection")
    training_section_model.objects.filter(
        slug="typical-week",
        title__in=("Типтик жума", "Типтуу жума", "Титүү жумасы"),
    ).update(title="Типтүү жумасы")


def restore_typical_week_name(apps, schema_editor):
    training_section_model = apps.get_model("accounts", "TrainingSection")
    training_section_model.objects.filter(
        slug="typical-week",
        title="Типтүү жумасы",
    ).update(title="Типтик жума")


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0048_translate_platform_titles_to_kyrgyz"),
    ]

    operations = [
        migrations.RunPython(
            rename_typical_week,
            restore_typical_week_name,
        ),
    ]
