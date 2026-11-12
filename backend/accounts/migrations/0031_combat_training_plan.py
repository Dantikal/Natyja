from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0030_training_period_created_by"),
    ]

    operations = [
        migrations.CreateModel(
            name="CombatTrainingPlan",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.TextField(verbose_name="Название плана")),
                ("layout", models.CharField(db_index=True, default="plan", max_length=30, verbose_name="Вид таблицы")),
                ("data", models.JSONField(blank=True, default=dict, verbose_name="Данные таблицы")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Создано")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Обновлено")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="combat_training_plans", to=settings.AUTH_USER_MODEL, verbose_name="Создал")),
            ],
            options={
                "verbose_name": "Плановое мероприятие боевой подготовки",
                "verbose_name_plural": "Плановые мероприятия боевой подготовки",
                "ordering": ("created_at", "id"),
            },
        ),
    ]
