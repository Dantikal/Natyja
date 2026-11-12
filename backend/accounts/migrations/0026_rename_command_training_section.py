from django.db import migrations


def rename_command_training_section(apps, schema_editor):
    TrainingSection = apps.get_model("accounts", "TrainingSection")
    TrainingSection.objects.filter(slug="command-training").update(
        title="Командирдик даярдоо"
    )


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0025_update_first_command_thematic_period_months"),
    ]

    operations = [
        migrations.RunPython(
            rename_command_training_section,
            migrations.RunPython.noop,
        ),
    ]
