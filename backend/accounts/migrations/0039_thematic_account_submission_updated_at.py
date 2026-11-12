from django.db import migrations, models
from django.utils import timezone


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0038_combat_training_journal_subjects"),
    ]

    operations = [
        migrations.AddField(
            model_name="thematicaccountsubmission",
            name="updated_at",
            field=models.DateTimeField(
                auto_now=True,
                default=timezone.now,
                verbose_name="Обновлено",
            ),
            preserve_default=False,
        ),
    ]
