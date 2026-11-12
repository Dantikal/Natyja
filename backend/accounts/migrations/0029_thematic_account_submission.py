from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0028_add_typical_week_section"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ThematicAccountSubmission",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("unit_number", models.CharField(max_length=120, verbose_name="Аскер бөлүгүнүн номери")),
                ("outpost_name", models.CharField(blank=True, max_length=160, verbose_name="Заставанын аталышы")),
                ("document_title", models.CharField(max_length=255, verbose_name="Иш кагаздардын аталышы")),
                ("section_slug", models.CharField(default="thematic-account", max_length=80, verbose_name="Раздел")),
                ("period_slug", models.CharField(blank=True, max_length=100, verbose_name="Период")),
                ("table_data", models.JSONField(default=dict, verbose_name="Таблица")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Отправлено")),
                ("sender", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="thematic_account_submissions", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "Отправленный тематический эсеп",
                "verbose_name_plural": "Отправленные тематические эсептер",
                "ordering": ("-created_at", "-id"),
            },
        ),
    ]
