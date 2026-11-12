from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0040_combat_training_journal_revision"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CombatTrainingJournalRevisionRead",
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
                ("read_at", models.DateTimeField(auto_now=True)),
                (
                    "revision",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="reads",
                        to="accounts.combattrainingjournalrevision",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="combat_training_journal_revision_reads",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Просмотр обновления журнала боевой подготовки",
                "verbose_name_plural": "Просмотры обновлений журналов боевой подготовки",
            },
        ),
        migrations.AddConstraint(
            model_name="combattrainingjournalrevisionread",
            constraint=models.UniqueConstraint(
                fields=("revision", "user"),
                name="unique_combat_training_journal_revision_read",
            ),
        ),
    ]
