from django.db import migrations, models


def remove_global_subjects(apps, schema_editor):
    subject_model = apps.get_model("accounts", "CombatTrainingJournalSubject")
    subject_model.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0046_combat_training_plan_notifications"),
    ]

    operations = [
        migrations.AddField(
            model_name="combattrainingjournalsubject",
            name="unit_number",
            field=models.CharField(
                db_index=True,
                default="",
                max_length=120,
                verbose_name="Аскер бөлүгүнүн номери",
            ),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name="combattrainingjournalsubject",
            name="title",
            field=models.CharField(
                max_length=255,
                verbose_name="Название предмета",
            ),
        ),
        migrations.RunPython(
            remove_global_subjects,
            migrations.RunPython.noop,
        ),
        migrations.AddConstraint(
            model_name="combattrainingjournalsubject",
            constraint=models.UniqueConstraint(
                fields=("unit_number", "title"),
                name="unique_combat_training_subject_per_unit",
            ),
        ),
    ]
