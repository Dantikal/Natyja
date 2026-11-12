from django.db import migrations


THEMATIC_ACCOUNT_SECTION_SLUGS = ("thematic-account", "command-thematic-account")


def build_thematic_account_table_title(period_number):
    return (
        f"20__-окуу жылынын {period_number} мезгилине"
        '_______аскер бөлүгүнүн "__________" чек ара заставынын '
        "(тобунун, взвод, ротосынын) өздүк курамы  менен өтүлгүүчү   "
        "сабактардын тематикалык эсеп сааты."
    )


def update_thematic_account_table_title(apps, schema_editor):
    TrainingTable = apps.get_model("accounts", "TrainingTable")

    for period_number in (1, 2):
        TrainingTable.objects.filter(
            period__section__slug__in=THEMATIC_ACCOUNT_SECTION_SLUGS,
            period__slug=f"period-{period_number}",
        ).update(title=build_thematic_account_table_title(period_number))


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0010_use_thematic_account_year_placeholder"),
    ]

    operations = [
        migrations.RunPython(
            update_thematic_account_table_title,
            migrations.RunPython.noop,
        ),
    ]
