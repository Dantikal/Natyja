from django.db import models

from accounts.models import User


class CombatTrainingNews(models.Model):
    title = models.CharField("Заголовок", max_length=255)
    body = models.TextField("Текст", blank=True)
    author = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="combat_training_news",
    )
    created_at = models.DateTimeField("Опубликовано", auto_now_add=True)
    updated_at = models.DateTimeField("Обновлено", auto_now=True)

    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        ordering = ("-created_at", "-id")
        verbose_name = "Новость о боевой подготовке"
        verbose_name_plural = "Новости о боевой подготовке"

    def __str__(self):
        return self.title


class CombatTrainingNewsAttachment(models.Model):
    news = models.ForeignKey(
        CombatTrainingNews,
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    file = models.FileField("Файл", upload_to="combat_training_news/%Y/%m/")
    original_name = models.CharField("Имя файла", max_length=255)
    kind = models.CharField("Тип", max_length=20, default="file")
    size = models.PositiveBigIntegerField("Размер", default=0)
    created_at = models.DateTimeField("Загружен", auto_now_add=True)

    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        ordering = ("id",)

    def __str__(self):
        return self.original_name


class CombatTrainingNewsLike(models.Model):
    class Reaction(models.TextChoices):
        LIKE = "like", "Нравится"
        LOVE = "love", "Люблю"
        LAUGH = "laugh", "Смешно"
        WOW = "wow", "Удивительно"
        CLAP = "clap", "Аплодисменты"

    news = models.ForeignKey(
        CombatTrainingNews,
        on_delete=models.CASCADE,
        related_name="likes",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="combat_training_news_likes",
    )
    reaction_type = models.CharField(max_length=10, choices=Reaction.choices, default=Reaction.LIKE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        constraints = [
            models.UniqueConstraint(
                fields=("news", "user", "reaction_type"),
                name="unique_combat_news_reaction",
            )
        ]


class CombatTrainingNewsRead(models.Model):
    news = models.ForeignKey(
        CombatTrainingNews,
        on_delete=models.CASCADE,
        related_name="reads",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="combat_training_news_reads",
    )
    read_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "accounts"  # Preserve deployed tables, permissions and migration history.
        constraints = [
            models.UniqueConstraint(
                fields=("news", "user"),
                name="unique_combat_training_news_read",
            )
        ]
