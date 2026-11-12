from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0042_combattrainingjournalrevisionhidden"),
    ]

    operations = [
        migrations.AddField(
            model_name="methodicalmanualsubject",
            name="collection",
            field=models.CharField(
                choices=[
                    ("methodical_manuals", "Усулдук колдонмолор"),
                    (
                        "young_soldier_program",
                        "Жаш жоокерлерди даярдоо программасы",
                    ),
                ],
                default="methodical_manuals",
                max_length=40,
                verbose_name="Раздел",
            ),
        ),
        migrations.AlterModelOptions(
            name="methodicalmanualsubject",
            options={
                "ordering": ("collection", "order", "title"),
                "verbose_name": "Предмет усулдук колдонмолор",
                "verbose_name_plural": "Предметы усулдук колдонмолор",
            },
        ),
    ]
