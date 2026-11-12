from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0043_methodicalmanualsubject_collection"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ThematicAccountSubmissionRead",
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
                    "submission",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="reads",
                        to="accounts.thematicaccountsubmission",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="thematic_account_submission_reads",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Просмотр отправленного документа",
                "verbose_name_plural": "Просмотры отправленных документов",
            },
        ),
        migrations.AddConstraint(
            model_name="thematicaccountsubmissionread",
            constraint=models.UniqueConstraint(
                fields=("submission", "user"),
                name="unique_thematic_account_submission_read",
            ),
        ),
    ]
