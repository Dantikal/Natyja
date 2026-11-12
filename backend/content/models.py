from django.db import models

from accounts.models import User


class ModuleTemplate(models.Model):
    module_key = models.CharField("Раздел", max_length=64, db_index=True)
    title = models.CharField("Название", max_length=255)
    file = models.FileField("PDF-файл", upload_to="module_templates/%Y/%m/")
    uploaded_by = models.ForeignKey(
        User,
        verbose_name="Загрузил",
        on_delete=models.SET_NULL,
        null=True,
        related_name="module_templates",
    )
    created_at = models.DateTimeField("Загружено", auto_now_add=True)

    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        ordering = ("-created_at", "-id")
        verbose_name = "Үлгү раздела"
        verbose_name_plural = "Үлгү разделов"

    def __str__(self):
        return f"{self.module_key}: {self.title}"


class ModuleBanner(models.Model):
    module_key = models.CharField("Раздел", max_length=64, db_index=True)
    title = models.CharField("Название", max_length=255)
    description = models.TextField("Дополнительная информация", blank=True)
    file = models.FileField("Фото или видео", upload_to="module_banners/%Y/%m/")
    uploaded_by = models.ForeignKey(
        User,
        verbose_name="Опубликовал",
        on_delete=models.SET_NULL,
        null=True,
        related_name="module_banners",
    )
    created_at = models.DateTimeField("Опубликовано", auto_now_add=True)

    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        ordering = ("-created_at", "-id")
        verbose_name = "Баннер раздела"
        verbose_name_plural = "Баннеры разделов"

    def __str__(self):
        return f"{self.module_key}: {self.title}"


class ModuleBannerMedia(models.Model):
    banner = models.ForeignKey(
        ModuleBanner,
        verbose_name="Баннер",
        on_delete=models.CASCADE,
        related_name="additional_media",
    )
    file = models.FileField("Фото или видео", upload_to="module_banners/%Y/%m/")
    created_at = models.DateTimeField("Загружено", auto_now_add=True)

    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        ordering = ("id",)
        verbose_name = "Дополнительный файл баннера"
        verbose_name_plural = "Дополнительные файлы баннеров"
