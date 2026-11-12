from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0057_adminchatmessage_is_broadcast"),
    ]

    operations = [
        migrations.AddField(
            model_name="adminchatmessage",
            name="broadcast_id",
            field=models.UUIDField(
                blank=True,
                db_index=True,
                null=True,
                verbose_name="Идентификатор рассылки",
            ),
        ),
    ]
