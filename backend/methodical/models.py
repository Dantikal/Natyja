from django.db import models

from accounts.models import User


class MethodicalManualSubject(models.Model):
    class Collection(models.TextChoices):
        METHODICAL_MANUALS = "methodical_manuals", "Усулдук колдонмолор"
        YOUNG_SOLDIER_PROGRAM = "young_soldier_program", "Жаш жоокерлерди даярдоо программасы"

    title = models.CharField("Название предмета", max_length=255)
    collection = models.CharField(
        "Раздел",
        max_length=40,
        choices=Collection.choices,
        default=Collection.METHODICAL_MANUALS,
    )
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.CASCADE,
        related_name="children", verbose_name="Раздел",
    )
    order = models.PositiveIntegerField("Порядок", default=0)
    is_active = models.BooleanField("Активен", default=True)
    created_at = models.DateTimeField("Создан", auto_now_add=True)
    updated_at = models.DateTimeField("Обновлен", auto_now=True)

    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        ordering = ("collection", "order", "title")
        verbose_name = "Предмет усулдук колдонмолор"
        verbose_name_plural = "Предметы усулдук колдонмолор"

    def __str__(self):
        return self.title


class MethodicalManualDocument(models.Model):
    subject = models.ForeignKey(
        MethodicalManualSubject,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    title = models.CharField("Название", max_length=255)
    file = models.FileField(
        "Файл",
        upload_to="methodical_manuals/%Y/%m/",
        blank=True,
        null=True,
    )
    original_name = models.CharField("Имя файла", max_length=255, blank=True)
    content = models.TextField("Текст материала", blank=True)
    preview_html = models.TextField("Содержимое для просмотра", blank=True)
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="methodical_manual_documents",
    )
    created_at = models.DateTimeField("Создан", auto_now_add=True)
    updated_at = models.DateTimeField("Обновлен", auto_now=True)

    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        ordering = ("-created_at", "-id")
        verbose_name = "Документ учебной программы"
        verbose_name_plural = "Документы учебных программ"

    def __str__(self):
        return self.title
