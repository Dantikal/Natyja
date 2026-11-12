from django.core.exceptions import ValidationError
from django.db import models

from accounts.models import User


class TrainingSection(models.Model):
    slug = models.SlugField("ID раздела", max_length=80, unique=True)
    title = models.CharField("Название", max_length=255)
    parent = models.ForeignKey(
        "self",
        verbose_name="Родительский раздел",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="subsections",
    )
    order = models.PositiveIntegerField("Порядок", default=0)
    is_active = models.BooleanField("Активен", default=True)

    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        ordering = ("parent_id", "order", "title")
        verbose_name = "Раздел подготовки"
        verbose_name_plural = "Разделы подготовки"

    def __str__(self):
        if self.parent_id:
            return f"{self.parent.title} / {self.title}"
        return self.title


class TrainingPeriod(models.Model):
    section = models.ForeignKey(
        TrainingSection,
        verbose_name="Раздел",
        on_delete=models.CASCADE,
        related_name="periods",
    )
    created_by = models.ForeignKey(
        User,
        verbose_name="Создал",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="created_training_periods",
    )
    slug = models.SlugField("ID периода", max_length=100)
    title = models.CharField("Название", max_length=255)
    order = models.PositiveIntegerField("Порядок", default=0)
    is_active = models.BooleanField("Активен", default=True)

    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        ordering = ("section", "order", "title")
        constraints = [
            models.UniqueConstraint(
                fields=("section", "slug"),
                name="unique_training_period_per_section",
            )
        ]
        verbose_name = "Период подготовки"
        verbose_name_plural = "Периоды подготовки"

    def __str__(self):
        return self.title


class LessonSchedulePeriod(TrainingPeriod):
    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        proxy = True
        verbose_name = "Сабактардын жүгүртмөсү"
        verbose_name_plural = "Сабактардын жүгүртмөсү"


class TrainingTable(models.Model):
    class Variant(models.TextChoices):
        DEFAULT = "", "Обычная таблица"
        LESSON_SCHEDULE = "lesson-schedule", "Сабактардын жүгүртмөсү"

    period = models.OneToOneField(
        TrainingPeriod,
        verbose_name="Период",
        on_delete=models.CASCADE,
        related_name="table",
    )
    title = models.CharField("Название", max_length=500)
    variant = models.CharField(
        "Тип таблицы",
        max_length=40,
        blank=True,
        choices=Variant.choices,
        default=Variant.DEFAULT,
    )
    columns = models.JSONField("Колонки", default=list)
    rows = models.JSONField("Строки", default=list, blank=True)
    header_fields = models.JSONField("Поля шапки", default=list, blank=True)
    header_rows = models.JSONField("Строки шапки", default=list, blank=True)
    is_active = models.BooleanField("Активна", default=True)
    created_at = models.DateTimeField("Создана", auto_now_add=True)
    updated_at = models.DateTimeField("Обновлена", auto_now=True)

    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        ordering = ("period",)
        verbose_name = "Таблица подготовки"
        verbose_name_plural = "Таблицы подготовки"

    def clean(self):
        super().clean()
        for field_name in ("columns", "rows", "header_fields", "header_rows"):
            value = getattr(self, field_name)
            if not isinstance(value, list):
                raise ValidationError({field_name: "Значение должно быть JSON-массивом."})

    def to_payload(self):
        payload = {
            "title": self.title,
            "columns": self.columns or [],
            "rows": self.rows or [],
        }
        if self.variant:
            payload["variant"] = self.variant
        if self.header_fields:
            payload["headerFields"] = self.header_fields
        if self.header_rows:
            payload["headerRows"] = self.header_rows
        return payload

    def __str__(self):
        return self.title
