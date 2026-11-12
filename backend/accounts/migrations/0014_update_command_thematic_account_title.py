from django.db import migrations


COMMAND_THEMATIC_ACCOUNT_SECTION_SLUG = "command-thematic-account"


def build_command_thematic_account_table_title(period_number):
    return (
        f'20__-окуу жылынын {period_number} мезгилине_______аскер бөлүгүнүн "__________" чек ара заставынын '
        "(тобунун, взвод, ротосынын) сержант,  прапорщиктердин\n"
        "өздүк курамы  менен өтүлгүүчү "
        "командирдик даярдык боюбнча  сабактардын тематикалык эсеп сааты."
    )


def update_command_thematic_account_title(apps, schema_editor):
    TrainingTable = apps.get_model("accounts", "TrainingTable")
    for period_number in (1, 2):
        TrainingTable.objects.filter(
            period__section__slug=COMMAND_THEMATIC_ACCOUNT_SECTION_SLUG,
            period__slug=f"period-{period_number}",
        ).update(title=build_command_thematic_account_table_title(period_number))


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0013_lesson_schedule_admin_proxy_and_title"),
    ]

    operations = [
        migrations.RunPython(
            update_command_thematic_account_title,
            migrations.RunPython.noop,
        ),
    ]
