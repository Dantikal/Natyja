from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0062_methodicalmanualsubject_parent"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="unit_type",
            field=models.CharField(
                choices=[
                    ("regional_department", "Войсковая часть №"),
                    ("outpost", "Застава"),
                    ("checkpoint", "КӨП"),
                    ("detachment", "Отряд"),
                    ("group", "Топ"),
                    ("company", "Рота"),
                    ("platoon", "Взвод"),
                    ("institution", "Мекеме"),
                ],
                max_length=160,
                verbose_name="Подразделение",
            ),
        ),
    ]
