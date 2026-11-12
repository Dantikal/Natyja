from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0035_restore_command_training_system_periods"),
    ]

    operations = [
        migrations.AlterField(
            model_name="methodicalmanualdocument",
            name="file",
            field=models.FileField(
                blank=True,
                null=True,
                upload_to="methodical_manuals/%Y/%m/",
                verbose_name="Файл",
            ),
        ),
        migrations.AlterField(
            model_name="methodicalmanualdocument",
            name="original_name",
            field=models.CharField(blank=True, max_length=255, verbose_name="Имя файла"),
        ),
        migrations.AddField(
            model_name="methodicalmanualdocument",
            name="content",
            field=models.TextField(blank=True, verbose_name="Текст материала"),
        ),
    ]
