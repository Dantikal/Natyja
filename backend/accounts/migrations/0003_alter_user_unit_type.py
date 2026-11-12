from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_user_avatar"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="unit_type",
            field=models.CharField(max_length=160, verbose_name="Подразделение"),
        ),
    ]
