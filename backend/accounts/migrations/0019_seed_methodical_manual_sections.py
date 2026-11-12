from django.db import migrations
from django.db.models import Max


SECTION_TITLES = (
    "Күжүрмөн даярдоонун окуу программалары",
    "Насааттамалар, нускамалар жана жоболор",
    "Электрондук китептер",
    "Электрондук план-конспектилер",
    "Ведомосттордун үлгүлөрү",
    "Нормативные правовые акты",
)


def add_methodical_manual_sections(apps, schema_editor):
    subject_model = apps.get_model("accounts", "MethodicalManualSubject")
    next_order = (subject_model.objects.aggregate(Max("order"))["order__max"] or 0) + 1

    for title in SECTION_TITLES:
        subject, created = subject_model.objects.get_or_create(
            title=title,
            defaults={"order": next_order, "is_active": True},
        )
        if created:
            next_order += 1
        elif not subject.is_active:
            subject.is_active = True
            subject.save(update_fields=("is_active",))


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0018_adminchatmessage"),
    ]

    operations = [
        migrations.RunPython(
            add_methodical_manual_sections,
            migrations.RunPython.noop,
        ),
    ]
