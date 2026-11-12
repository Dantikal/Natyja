from django.db import migrations


TITLE_RENAMES = {
    "Нормативные правовые акты": "Ченемдик укуктук актылар",
    "Ведомосттордун жана иш-кагаздардын үлгүлөрү": "Ведомосттордун жана иш кагаздардын үлгүлөрү",
}

CONTENT_TITLE_RENAMES = {
    "АТКАРЫЛГАН ИШ-ЧАРАЛАРЫ": "АТКАРЫЛГАН ИШ-ЧАРАЛАР",
}


def translate_titles(apps, schema_editor):
    subject_model = apps.get_model("accounts", "MethodicalManualSubject")
    for old_title, new_title in TITLE_RENAMES.items():
        subject_model.objects.filter(title=old_title).update(title=new_title)
    training_section_model = apps.get_model("accounts", "TrainingSection")
    training_section_model.objects.filter(title="Типовая неделя").update(
        title="Типтик жума"
    )
    for model_name in (
        "TrainingSection",
        "TrainingPeriod",
        "TrainingTable",
        "MethodicalManualSubject",
        "MethodicalManualDocument",
        "CombatTrainingNews",
        "CombatTrainingPlan",
    ):
        model = apps.get_model("accounts", model_name)
        for old_title, new_title in CONTENT_TITLE_RENAMES.items():
            model.objects.filter(title=old_title).update(title=new_title)


def restore_titles(apps, schema_editor):
    subject_model = apps.get_model("accounts", "MethodicalManualSubject")
    for old_title, new_title in TITLE_RENAMES.items():
        subject_model.objects.filter(title=new_title).update(title=old_title)
    training_section_model = apps.get_model("accounts", "TrainingSection")
    training_section_model.objects.filter(title="Типтик жума").update(
        title="Типовая неделя"
    )
    for model_name in (
        "TrainingSection",
        "TrainingPeriod",
        "TrainingTable",
        "MethodicalManualSubject",
        "MethodicalManualDocument",
        "CombatTrainingNews",
        "CombatTrainingPlan",
    ):
        model = apps.get_model("accounts", model_name)
        for old_title, new_title in CONTENT_TITLE_RENAMES.items():
            model.objects.filter(title=new_title).update(title=old_title)


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0047_unit_specific_combat_training_subjects"),
    ]

    operations = [
        migrations.RunPython(translate_titles, restore_titles),
    ]
