from django.db import migrations


MONTH_COLUMNS = [
    {"key": "december", "label": "Декабрь", "type": "datetime-local"},
    {"key": "january", "label": "Январь", "type": "datetime-local"},
    {"key": "february", "label": "Февраль", "type": "datetime-local"},
    {"key": "march", "label": "Март", "type": "datetime-local"},
    {"key": "june", "label": "Июнь", "type": "datetime-local"},
    {"key": "july", "label": "Июль", "type": "datetime-local"},
    {"key": "august", "label": "Август", "type": "datetime-local"},
    {"key": "september", "label": "Сентябрь", "type": "datetime-local"},
]


def update_first_thematic_period_months(apps, schema_editor):
    TrainingTable = apps.get_model("accounts", "TrainingTable")
    tables = TrainingTable.objects.filter(
        period__section__slug="thematic-account",
        period__slug="period-1",
    )

    for table in tables:
        fixed_columns = [
            column
            for column in (table.columns or [])
            if column.get("key") in {"number", "topic", "hours"}
        ]
        table.columns = fixed_columns + MONTH_COLUMNS

        next_rows = []
        for row in table.rows or []:
            next_row = {
                key: value
                for key, value in row.items()
                if key not in {"october"}
            }
            for column in MONTH_COLUMNS:
                next_row.setdefault(column["key"], "")
            next_rows.append(next_row)
        table.rows = next_rows
        table.save(update_fields=["columns", "rows", "updated_at"])


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0023_remove_second_thematic_period"),
    ]

    operations = [
        migrations.RunPython(
            update_first_thematic_period_months,
            migrations.RunPython.noop,
        ),
    ]
