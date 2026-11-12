from django.db import migrations


def fix_typical_week_title(apps, schema_editor):
    training_section_model = apps.get_model("accounts", "TrainingSection")
    training_section_model.objects.filter(slug="typical-week").update(
        title="Типтүү жумасы"
    )


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0049_rename_typical_week"),
    ]

    operations = [
        migrations.RunPython(
            fix_typical_week_title,
            migrations.RunPython.noop,
        ),
    ]
