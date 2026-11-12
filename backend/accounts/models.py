from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "Администратор"
        MANAGEMENT = "management", "Управление"
        REGIONAL = "regional", "Областное управление"
        OUTPOST = "outpost", "Застава"

    class Status(models.TextChoices):
        PENDING = "pending", "На рассмотрении"
        ACTIVE = "active", "Активен"
        REJECTED = "rejected", "Отклонен"

    class UnitType(models.TextChoices):
        MANAGEMENT = "management", "Управление"
        REGIONAL = "regional_department", "Войсковая часть №"
        OUTPOST = "outpost", "Застава"
        SUBDIVISION = "subdivision", "Бөлүмчө"
        CHECKPOINT = "checkpoint", "КӨП"
        DETACHMENT = "detachment", "Отряд"
        GROUP = "group", "Топ"
        COMPANY = "company", "Рота"
        PLATOON = "platoon", "Взвод"
        INSTITUTION = "institution", "КЖжАККДБ"
        CYNOLOGY = "cynology", "Кинология кызматы"
        COURSE_HEAD = "course_head", "Курстун бачысы"
        TRAINING_CENTER_HEAD = "training_center_head", "Окуу борбордун башчысы"
        TRAINING_PLATOON_COMMANDER = "training_platoon_commander", "Окуу взводдун командири"

    email = models.EmailField("Email", unique=True)
    full_name = models.CharField("ФИО", max_length=255, blank=True)
    military_rank = models.CharField("Воинское звание", max_length=120, blank=True)
    position = models.CharField("Должность", max_length=160, blank=True)
    unit_type = models.CharField(
        "Подразделение",
        max_length=160,
        choices=UnitType.choices,
    )
    phone = models.CharField("Телефон", max_length=20, blank=True)
    region = models.CharField("Область", max_length=120, blank=True)
    outpost_name = models.CharField("Название заставы", max_length=160, blank=True)
    training_center = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="training_platoons", verbose_name="Окуу борбору",
    )
    platoon_number = models.CharField("Окуу взводунун номери", max_length=12, blank=True)
    role = models.CharField("Роль", max_length=20, choices=Role.choices)
    status = models.CharField(
        "Статус", max_length=20, choices=Status.choices, default=Status.PENDING
    )
    photo_face = models.ImageField("Фото лица", upload_to="users/faces/", blank=True)
    avatar = models.ImageField("Аватар", upload_to="users/avatars/", blank=True)
    photo_military_id = models.ImageField(
        "Фото военного билета", upload_to="users/military_ids/", blank=True
    )
    rejection_reason = models.TextField("Причина отклонения", blank=True)
    profile_completed = models.BooleanField("Профиль заполнен", default=True)
    reviewed_at = models.DateTimeField("Дата модерации", null=True, blank=True)
    reviewed_by = models.ForeignKey(
        "self",
        verbose_name="Проверил",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_users",
    )

    REQUIRED_FIELDS = ["email", "full_name"]

    def clean(self):
        super().clean()
        if not self.pk:
            return

        previous = type(self).objects.filter(pk=self.pk).only("role").first()
        if (
            previous
            and previous.role == self.Role.ADMIN
            and self.role != self.Role.ADMIN
            and not type(self).objects.filter(role=self.Role.ADMIN).exclude(pk=self.pk).exists()
        ):
            raise ValidationError(
                {"role": "Нельзя снять роль администратора у последнего администратора."}
            )

    def save(self, *args, **kwargs):
        if self.is_superuser:
            self.role = self.Role.ADMIN
            self.status = self.Status.ACTIVE
            self.is_staff = True
        elif self.role == self.Role.ADMIN:
            self.status = self.Status.ACTIVE
            self.is_staff = True
        else:
            self.is_staff = False
            self.is_superuser = False

        self.is_active = self.status == self.Status.ACTIVE
        if not self.full_name:
            self.full_name = self.get_full_name() or self.username
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.full_name} ({self.email})"


# Backwards-compatible imports for existing integrations.
from content.models import ModuleBanner
from content.models import ModuleBannerMedia
from content.models import ModuleTemplate
from journals.models import CombatTrainingJournal
from journals.models import CombatTrainingJournalSection
from journals.models import CombatTrainingJournalSubject
from messaging.models import AdminChatMessage
from methodical.models import MethodicalManualDocument
from methodical.models import MethodicalManualSubject
from news.models import CombatTrainingNews
from news.models import CombatTrainingNewsAttachment
from news.models import CombatTrainingNewsLike
from news.models import CombatTrainingNewsRead
from plans.models import CombatTrainingPlan
from plans.models import CombatTrainingPlanRead
from submissions.models import CombatTrainingJournalRevision
from submissions.models import CombatTrainingJournalRevisionHidden
from submissions.models import CombatTrainingJournalRevisionRead
from submissions.models import SubmissionEditRequest
from submissions.models import ThematicAccountSubmission
from submissions.models import ThematicAccountSubmissionHidden
from submissions.models import ThematicAccountSubmissionRead
from training.models import LessonSchedulePeriod
from training.models import TrainingPeriod
from training.models import TrainingSection
from training.models import TrainingTable


class PlatformTeamPhoto(models.Model):
    member = models.CharField(max_length=20, primary_key=True, choices=[
        ("shakenov", "Шакенов М.С."),
        ("akmatov", "Акматов Б.А."),
        ("saifudinov", "Сайфудинов Д.А."),
    ])
    photo = models.ImageField(upload_to="platform/team/")

class ResultDocumentSample(models.Model):
    period_key = models.CharField(max_length=200)
    unit_number = models.CharField(max_length=120, blank=True)
    original_name = models.CharField(max_length=255)
    file = models.FileField(upload_to='result_samples/%Y/%m/')
    uploaded_by = models.ForeignKey(User, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
