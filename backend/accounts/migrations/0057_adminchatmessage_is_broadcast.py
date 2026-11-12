from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0056_user_profile_completed"),
    ]

    operations = [
        migrations.AddField(
            model_name="adminchatmessage",
            name="is_broadcast",
            field=models.BooleanField(
                default=False,
                verbose_name="Сообщение общей группе застав",
            ),
        ),
    ]
