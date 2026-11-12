from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0041_combattrainingjournalrevisionread"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CombatTrainingJournalRevisionHidden",
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
                ("hidden_at", models.DateTimeField(auto_now_add=True)),
                (
                    "revision",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="hidden_by",
                        to="accounts.combattrainingjournalrevision",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="hidden_combat_training_journal_revisions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Скрытое обновление журнала боевой подготовки",
                "verbose_name_plural": "Скрытые обновления журналов боевой подготовки",
            },
        ),
        migrations.AddConstraint(
            model_name="combattrainingjournalrevisionhidden",
            constraint=models.UniqueConstraint(
                fields=("revision", "user"),
                name="unique_hidden_combat_training_journal_revision",
            ),
        ),
    ]
