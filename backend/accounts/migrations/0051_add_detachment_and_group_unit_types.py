from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0050_fix_typical_week_title"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="unit_type",
            field=models.CharField(
                choices=[
                    ("regional_department", "Войсковая часть №"),
                    ("outpost", "Застава"),
                    ("detachment", "Отряд"),
                    ("group", "Топ"),
                ],
                max_length=160,
                verbose_name="Подразделение",
            ),
        ),
    ]
