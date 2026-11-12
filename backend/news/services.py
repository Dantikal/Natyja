from pathlib import Path

from django.db.models import Q
from rest_framework.exceptions import ValidationError

from accounts.models import User
from news.constants import NEWS_ALLOWED_EXTENSIONS, NEWS_MAX_FILES, NEWS_MAX_FILE_SIZE
from news.models import CombatTrainingNews, CombatTrainingNewsAttachment


def get_news_attachment_kind(uploaded_file):
    content_type = (getattr(uploaded_file, "content_type", "") or "").lower()
    extension = Path(uploaded_file.name).suffix.lower()
    if content_type.startswith("image/") or extension in {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}:
        return "image"
    if content_type.startswith("video/") or extension in {".mp4", ".webm", ".mov", ".avi", ".mkv"}:
        return "video"
    if content_type.startswith("audio/") or extension in {".mp3", ".wav", ".ogg", ".m4a"}:
        return "audio"
    if extension == ".pdf":
        return "pdf"
    return "file"


def validate_news_files(files):
    if len(files) > NEWS_MAX_FILES:
        raise ValidationError({"files": f"Можно прикрепить не более {NEWS_MAX_FILES} файлов."})
    for uploaded_file in files:
        extension = Path(uploaded_file.name).suffix.lower()
        if extension not in NEWS_ALLOWED_EXTENSIONS:
            raise ValidationError({"files": f"Формат файла {uploaded_file.name} не поддерживается."})
        if uploaded_file.size > NEWS_MAX_FILE_SIZE:
            raise ValidationError({"files": f"Файл {uploaded_file.name} превышает 100 МБ."})


def create_news_attachments(news, files):
    for uploaded_file in files:
        CombatTrainingNewsAttachment.objects.create(
            news=news,
            file=uploaded_file,
            original_name=uploaded_file.name[:255],
            kind=get_news_attachment_kind(uploaded_file),
            size=uploaded_file.size,
        )


def visible_combat_training_news(user):
    news_items = CombatTrainingNews.objects.all()
    if user.role == User.Role.ADMIN or user.is_superuser:
        return news_items

    visibility = Q(author__isnull=True) | Q(author__role=User.Role.ADMIN)
    unit_number = str(user.region or "").strip()
    if unit_number:
        visibility |= Q(
            author__role=User.Role.REGIONAL,
            author__region=unit_number,
        )
    elif user.role == User.Role.REGIONAL:
        visibility |= Q(author=user)
    return news_items.filter(visibility)
