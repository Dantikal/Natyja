from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0033_normative_legal_acts_first"),
    ]

    operations = [
        migrations.CreateModel(
            name="SubmissionEditRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("pending", "На рассмотрении"), ("approved", "Разрешено"), ("rejected", "Отклонено")], default="pending", max_length=16)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("requester", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="submission_edit_requests", to=settings.AUTH_USER_MODEL)),
                ("reviewed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="reviewed_submission_edit_requests", to=settings.AUTH_USER_MODEL)),
                ("submission", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="edit_request", to="accounts.thematicaccountsubmission")),
            ],
            options={
                "verbose_name": "Запрос на исправление документа",
                "verbose_name_plural": "Запросы на исправление документов",
                "ordering": ("-updated_at", "-id"),
            },
        ),
    ]
