from django.db import migrations


OLD_TITLE = "Ведомосттордун үлгүлөрү"
NEW_TITLE = "Ведомосттордун жана иш-кагаздардын үлгүлөрү"


def rename_forms_section(apps, schema_editor):
    subject_model = apps.get_model("accounts", "MethodicalManualSubject")
    subject_model.objects.filter(
        title=OLD_TITLE,
        collection="methodical_manuals",
    ).update(title=NEW_TITLE)


def restore_forms_section_title(apps, schema_editor):
    subject_model = apps.get_model("accounts", "MethodicalManualSubject")
    subject_model.objects.filter(
        title=NEW_TITLE,
        collection="methodical_manuals",
    ).update(title=OLD_TITLE)


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0044_thematicaccountsubmissionread"),
    ]

    operations = [
        migrations.RunPython(
            rename_forms_section,
            restore_forms_section_title,
        ),
    ]
