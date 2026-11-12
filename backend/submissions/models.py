from django.db import models
from django.utils import timezone

from accounts.models import User


class ThematicAccountSubmission(models.Model):
    sender = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="thematic_account_submissions",
    )
    unit_number = models.CharField("Аскер бөлүгүнүн номери", max_length=120)
    outpost_name = models.CharField("Заставанын аталышы", max_length=160, blank=True)
    document_title = models.CharField("Иш кагаздардын аталышы", max_length=255)
    section_slug = models.CharField("Раздел", max_length=80, default="thematic-account")
    period_slug = models.CharField("Период", max_length=100, blank=True)
    table_data = models.JSONField("Таблица", default=dict)
    is_corrected = models.BooleanField("Исправлен и повторно отправлен", default=False)
    created_at = models.DateTimeField("Отправлено", auto_now_add=True)
    updated_at = models.DateTimeField("Обновлено", auto_now=True)

    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        ordering = ("-created_at", "-id")
        verbose_name = "Отправленный тематический эсеп"
        verbose_name_plural = "Отправленные тематические эсептер"

    def __str__(self):
        return self.document_title


class SubmissionArchiveCopy(models.Model):
    """Read-only snapshot of a document at the moment it was sent."""

    source_submission_id = models.PositiveBigIntegerField()
    sender_id_snapshot = models.PositiveBigIntegerField(db_index=True)
    sender_name = models.CharField(max_length=255, blank=True)
    unit_number = models.CharField(max_length=120, blank=True)
    outpost_name = models.CharField(max_length=160, blank=True)
    document_title = models.CharField(max_length=255)
    section_slug = models.CharField(max_length=80)
    period_slug = models.CharField(max_length=100, blank=True)
    table_data = models.JSONField(default=dict)
    year = models.PositiveSmallIntegerField(db_index=True)
    archived_at = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "accounts"
        ordering = ("-archived_at", "-id")
        constraints = [models.UniqueConstraint(
            fields=("sender_id_snapshot", "year", "period_slug"),
            condition=models.Q(source_submission_id=0), name="unique_annual_draft_archive",
        )]

    def __str__(self):
        return f"{self.year}: {self.document_title}"


class ThematicAccountSubmissionRead(models.Model):
    submission = models.ForeignKey(
        ThematicAccountSubmission,
        on_delete=models.CASCADE,
        related_name="reads",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="thematic_account_submission_reads",
    )
    read_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        constraints = [
            models.UniqueConstraint(
                fields=("submission", "user"),
                name="unique_thematic_account_submission_read",
            )
        ]
        verbose_name = "Просмотр отправленного документа"
        verbose_name_plural = "Просмотры отправленных документов"


class ThematicAccountSubmissionHidden(models.Model):
    submission = models.ForeignKey(
        ThematicAccountSubmission,
        on_delete=models.CASCADE,
        related_name="hidden_by",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="hidden_thematic_account_submissions",
    )
    hidden_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        constraints = [
            models.UniqueConstraint(
                fields=("submission", "user"),
                name="unique_hidden_thematic_account_submission",
            )
        ]
        verbose_name = "Скрытый отправленный документ"
        verbose_name_plural = "Скрытые отправленные документы"


class CombatTrainingJournalRevision(models.Model):
    submission = models.ForeignKey(
        ThematicAccountSubmission,
        on_delete=models.CASCADE,
        related_name="revisions",
    )
    document_title = models.CharField("Название журнала", max_length=255)
    table_data = models.JSONField("Снимок таблицы", default=dict)
    created_at = models.DateTimeField("Сохранено", auto_now_add=True)

    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        ordering = ("-created_at", "-id")
        verbose_name = "Обновление журнала боевой подготовки"
        verbose_name_plural = "Обновления журналов боевой подготовки"

    def __str__(self):
        return f"{self.document_title} — {self.created_at:%d.%m.%Y %H:%M}"


class CombatTrainingJournalRevisionRead(models.Model):
    revision = models.ForeignKey(
        CombatTrainingJournalRevision,
        on_delete=models.CASCADE,
        related_name="reads",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="combat_training_journal_revision_reads",
    )
    read_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        constraints = [
            models.UniqueConstraint(
                fields=("revision", "user"),
                name="unique_combat_training_journal_revision_read",
            )
        ]
        verbose_name = "Просмотр обновления журнала боевой подготовки"
        verbose_name_plural = "Просмотры обновлений журналов боевой подготовки"


class CombatTrainingJournalRevisionHidden(models.Model):
    revision = models.ForeignKey(
        CombatTrainingJournalRevision,
        on_delete=models.CASCADE,
        related_name="hidden_by",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="hidden_combat_training_journal_revisions",
    )
    hidden_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        constraints = [
            models.UniqueConstraint(
                fields=("revision", "user"),
                name="unique_hidden_combat_training_journal_revision",
            )
        ]
        verbose_name = "Скрытое обновление журнала боевой подготовки"
        verbose_name_plural = "Скрытые обновления журналов боевой подготовки"


class SubmissionEditRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "На рассмотрении"
        APPROVED = "approved", "Разрешено"
        REJECTED = "rejected", "Отклонено"
        CORRECTED = "corrected", "Изменено"

    submission = models.OneToOneField(
        ThematicAccountSubmission,
        on_delete=models.CASCADE,
        related_name="edit_request",
    )
    requester = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="submission_edit_requests",
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_submission_edit_requests",
    )

    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        ordering = ("-updated_at", "-id")
        verbose_name = "Запрос на исправление документа"
        verbose_name_plural = "Запросы на исправление документов"

    def __str__(self):
        return f"{self.submission.document_title}: {self.get_status_display()}"


class RatingPlanItem(models.Model):
    assignee = models.ForeignKey(User, on_delete=models.PROTECT, related_name='rating_plan_items')
    title = models.CharField(max_length=255)
    section_slug = models.CharField(max_length=80)
    starts_at = models.DateTimeField()
    deadline = models.DateTimeField()
    submission = models.ForeignKey(ThematicAccountSubmission, null=True, blank=True, on_delete=models.SET_NULL)
    status = models.CharField(max_length=16, default='pending', choices=[('pending','Ожидается'),('accepted','Принят'),('returned','На исправление')])
    returned_once = models.BooleanField(default=False)
    reviewed_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name='+')
    reviewed_at = models.DateTimeField(null=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='+')
    class Meta:
        app_label = 'accounts'
        constraints = [models.UniqueConstraint(fields=['assignee','section_slug','deadline','title'], name='unique_rating_plan_slot')]
