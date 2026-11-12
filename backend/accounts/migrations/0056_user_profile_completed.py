from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0055_modulebannermedia"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="profile_completed",
            field=models.BooleanField(default=True, verbose_name="Профиль заполнен"),
        ),
    ]
