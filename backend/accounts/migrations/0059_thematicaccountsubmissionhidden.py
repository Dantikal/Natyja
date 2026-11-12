from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0058_adminchatmessage_broadcast_id"),
    ]

    operations = [
        migrations.CreateModel(
            name="ThematicAccountSubmissionHidden",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("hidden_at", models.DateTimeField(auto_now_add=True)),
                (
                    "submission",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="hidden_by",
                        to="accounts.thematicaccountsubmission",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="hidden_thematic_account_submissions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Скрытый отправленный документ",
                "verbose_name_plural": "Скрытые отправленные документы",
                "constraints": [
                    models.UniqueConstraint(
                        fields=("submission", "user"),
                        name="unique_hidden_thematic_account_submission",
                    )
                ],
            },
        ),
    ]
