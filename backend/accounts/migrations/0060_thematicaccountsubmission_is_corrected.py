from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0059_thematicaccountsubmissionhidden"),
    ]

    operations = [
        migrations.AddField(
            model_name="thematicaccountsubmission",
            name="is_corrected",
            field=models.BooleanField(
                default=False,
                verbose_name="Исправлен и повторно отправлен",
            ),
        ),
    ]
