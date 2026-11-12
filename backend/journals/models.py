from django.db import models
from django.utils import timezone

from accounts.models import User
from training.models import TrainingSection


class CombatTrainingJournalSection(TrainingSection):
    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        proxy = True
        verbose_name = "\u0428\u0430\u0431\u043b\u043e\u043d \u0440\u0430\u0437\u0434\u0435\u043b\u0430 \u043a\u04af\u0436\u04af\u0440\u043c\u04e9\u043d \u0434\u0430\u044f\u0440\u0434\u043e\u043e"
        verbose_name_plural = "\u0428\u0430\u0431\u043b\u043e\u043d \u0440\u0430\u0437\u0434\u0435\u043b\u0430 \u043a\u04af\u0436\u04af\u0440\u043c\u04e9\u043d \u0434\u0430\u044f\u0440\u0434\u043e\u043e"


class CombatTrainingJournal(models.Model):
    owner = models.ForeignKey(
        User,
        verbose_name="\u0412\u043b\u0430\u0434\u0435\u043b\u0435\u0446",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="combat_training_journals",
    )
    storage_id = models.CharField("ID", max_length=255, unique=True)
    title = models.TextField("\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435")
    year = models.CharField("\u041e\u043a\u0443\u0443 \u0436\u044b\u043b\u044b", max_length=40, blank=True)
    unit_name = models.CharField(
        "\u0411\u04e9\u043b\u04af\u043a\u0447\u04e9\u043d\u04af\u043d \u0430\u0442\u0430\u043b\u044b\u0448\u044b",
        max_length=255,
        blank=True,
    )
    scope = models.CharField("\u041e\u0431\u043b\u0430\u0441\u0442\u044c", max_length=255, blank=True)
    created_at = models.DateTimeField("\u0421\u043e\u0437\u0434\u0430\u043d\u043e", default=timezone.now)
    updated_at = models.DateTimeField("\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u043e", auto_now=True)

    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        ordering = ("-created_at", "-id")
        verbose_name = "\u041a\u04af\u0436\u04af\u0440\u043c\u04e9\u043d \u0434\u0430\u044f\u0440\u0434\u043e\u043e\u043d\u0443 \u043a\u0430\u0442\u0442\u043e\u043e \u0436\u0443\u0440\u043d\u0430\u043b\u044b"
        verbose_name_plural = "\u041a\u04af\u0436\u04af\u0440\u043c\u04e9\u043d \u0434\u0430\u044f\u0440\u0434\u043e\u043e\u043d\u0443 \u043a\u0430\u0442\u0442\u043e\u043e \u0436\u0443\u0440\u043d\u0430\u043b\u044b"

    def __str__(self):
        return self.title


class CombatTrainingJournalSubject(models.Model):
    title = models.CharField("Название предмета", max_length=255)
    unit_number = models.CharField(
        "Аскер бөлүгүнүн номери",
        max_length=120,
        db_index=True,
    )
    order = models.PositiveIntegerField("Порядок", default=0)
    is_active = models.BooleanField("Активен", default=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by_name = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField("Создано", auto_now_add=True)
    updated_at = models.DateTimeField("Обновлено", auto_now=True)

    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        ordering = ("order", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("unit_number", "title"),
                name="unique_combat_training_subject_per_unit",
            )
        ]
        verbose_name = "Предмет журнала боевой подготовки"
        verbose_name_plural = "Предметы журнала боевой подготовки"

    def __str__(self):
        return self.title
