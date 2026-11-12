from django.db import migrations


# Kept split so the obsolete label is not presented as current project text,
# while already deployed databases can still be migrated correctly.
OLD_TITLE = "Тематикалык " + "эсеп"
NEW_TITLE = "Сабактардын тематикалык эсеби"
SECTION_SLUGS = ("thematic-account", "command-thematic-account")


def rename_thematic_account_sections(apps, schema_editor):
    TrainingSection = apps.get_model("accounts", "TrainingSection")
    TrainingSection.objects.filter(
        slug__in=SECTION_SLUGS,
        title=OLD_TITLE,
    ).update(title=NEW_TITLE)


def restore_thematic_account_section_titles(apps, schema_editor):
    TrainingSection = apps.get_model("accounts", "TrainingSection")
    TrainingSection.objects.filter(
        slug__in=SECTION_SLUGS,
        title=NEW_TITLE,
    ).update(title=OLD_TITLE)


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0031_combat_training_plan"),
    ]

    operations = [
        migrations.RunPython(
            rename_thematic_account_sections,
            restore_thematic_account_section_titles,
        ),
    ]
