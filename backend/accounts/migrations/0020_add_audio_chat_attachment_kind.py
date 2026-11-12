from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0019_seed_methodical_manual_sections"),
    ]

    operations = [
        migrations.AlterField(
            model_name="adminchatmessage",
            name="attachment_kind",
            field=models.CharField(
                blank=True,
                choices=[
                    ("image", "Image"),
                    ("video", "Video"),
                    ("audio", "Audio"),
                    ("file", "File"),
                ],
                default="",
                max_length=20,
                verbose_name="Тип вложения",
            ),
        ),
    ]
