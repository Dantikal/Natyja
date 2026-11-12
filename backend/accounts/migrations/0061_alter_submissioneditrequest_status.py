from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0060_thematicaccountsubmission_is_corrected"),
    ]

    operations = [
        migrations.AlterField(
            model_name="submissioneditrequest",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "На рассмотрении"),
                    ("approved", "Разрешено"),
                    ("rejected", "Отклонено"),
                    ("corrected", "Изменено"),
                ],
                default="pending",
                max_length=16,
            ),
        ),
    ]
