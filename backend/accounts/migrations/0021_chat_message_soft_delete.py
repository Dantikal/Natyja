from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0020_add_audio_chat_attachment_kind"),
    ]

    operations = [
        migrations.AddField(
            model_name="adminchatmessage",
            name="deleted_by_recipient",
            field=models.BooleanField(default=False, verbose_name="Удалено получателем у себя"),
        ),
        migrations.AddField(
            model_name="adminchatmessage",
            name="deleted_by_sender",
            field=models.BooleanField(default=False, verbose_name="Удалено отправителем у себя"),
        ),
        migrations.AddField(
            model_name="adminchatmessage",
            name="deleted_for_everyone",
            field=models.BooleanField(default=False, verbose_name="Удалено у всех"),
        ),
    ]
