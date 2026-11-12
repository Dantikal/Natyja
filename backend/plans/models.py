from django.db import models

from accounts.models import User


class CombatTrainingPlan(models.Model):
    title = models.TextField("Название плана")
    layout = models.CharField("Вид таблицы", max_length=30, default="plan", db_index=True)
    data = models.JSONField("Данные таблицы", default=dict, blank=True)
    created_by = models.ForeignKey(
        User,
        verbose_name="Создал",
        on_delete=models.SET_NULL,
        related_name="combat_training_plans",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField("Создано", auto_now_add=True)
    updated_at = models.DateTimeField("Обновлено", auto_now=True)
    published_at = models.DateTimeField(
        "Отправлено пользователям",
        null=True,
        blank=True,
        db_index=True,
    )

    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        ordering = ("created_at", "id")
        verbose_name = "Плановое мероприятие боевой подготовки"
        verbose_name_plural = "Плановые мероприятия боевой подготовки"


class CombatTrainingPlanRead(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="combat_training_plan_read",
    )
    read_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        verbose_name = "Просмотр обновления плановых мероприятий"
        verbose_name_plural = "Просмотры обновлений плановых мероприятий"
