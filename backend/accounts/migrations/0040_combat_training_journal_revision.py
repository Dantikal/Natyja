from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0039_thematic_account_submission_updated_at"),
    ]

    operations = [
        migrations.CreateModel(
            name="CombatTrainingJournalRevision",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("document_title", models.CharField(max_length=255, verbose_name="Название журнала")),
                ("table_data", models.JSONField(default=dict, verbose_name="Снимок таблицы")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Сохранено")),
                (
                    "submission",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="revisions",
                        to="accounts.thematicaccountsubmission",
                    ),
                ),
            ],
            options={
                "verbose_name": "Обновление журнала боевой подготовки",
                "verbose_name_plural": "Обновления журналов боевой подготовки",
                "ordering": ("-created_at", "-id"),
            },
        ),
    ]
