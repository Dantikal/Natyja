from django.db import migrations, models


def set_institution_role(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(unit_type="institution").update(role="regional")


def restore_institution_role(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(unit_type="institution").update(role="outpost")


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0051_add_detachment_and_group_unit_types"),
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
                    ("company", "Рота"),
                    ("platoon", "Взвод"),
                    ("institution", "Мекеме"),
                ],
                max_length=160,
                verbose_name="Подразделение",
            ),
        ),
        migrations.RunPython(set_institution_role, restore_institution_role),
    ]
