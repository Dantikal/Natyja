from django.db import migrations
from django.db.models import F


SECTION_TITLE = "Нормативные правовые акты"


def move_normative_legal_acts_first(apps, schema_editor):
    subject_model = apps.get_model("accounts", "MethodicalManualSubject")
    subject = subject_model.objects.filter(title=SECTION_TITLE).first()
    if subject is None:
        return

    subject_model.objects.exclude(pk=subject.pk).update(order=F("order") + 1)
    subject.order = 0
    subject.save(update_fields=("order",))


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0032_rename_thematic_account_sections"),
    ]

    operations = [
        migrations.RunPython(
            move_normative_legal_acts_first,
            migrations.RunPython.noop,
        ),
    ]
