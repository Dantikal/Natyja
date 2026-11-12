from pathlib import Path

from rest_framework import serializers

from methodical.docx_preview import DocxPreviewError, extract_docx_preview
from methodical.models import MethodicalManualDocument, MethodicalManualSubject


class MethodicalManualSubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = MethodicalManualSubject
        fields = [
            "id",
            "title",
            "collection",
            "parent",
            "order",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        parent = attrs.get("parent", getattr(self.instance, "parent", None))
        collection = attrs.get("collection", getattr(self.instance, "collection", MethodicalManualSubject.Collection.METHODICAL_MANUALS))
        if parent and (
            parent.pk == getattr(self.instance, "pk", None)
            or parent.parent_id is not None
            or not parent.is_active
            or parent.collection != collection
        ):
            raise serializers.ValidationError({"parent": "Выберите активный раздел той же коллекции."})
        if self.instance and parent and self.instance.children.exists():
            raise serializers.ValidationError({"parent": "Раздел с предметами нельзя вложить в другой раздел."})
        return attrs

    def validate_title(self, value):
        title = value.strip()
        if not title:
            raise serializers.ValidationError("Укажите название предмета.")
        return title


class MethodicalManualDocumentSerializer(serializers.ModelSerializer):
    originalName = serializers.CharField(source="original_name", read_only=True)
    previewHtml = serializers.CharField(source="preview_html", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    fileUrl = serializers.SerializerMethodField()
    kind = serializers.SerializerMethodField()

    IMAGE_EXTENSIONS = {".bmp", ".gif", ".jpeg", ".jpg", ".png", ".webp"}
    VIDEO_EXTENSIONS = {".avi", ".mkv", ".mov", ".mp4", ".m4v", ".webm"}
    AUDIO_EXTENSIONS = {".aac", ".flac", ".m4a", ".mp3", ".ogg", ".wav"}
    DOCUMENT_EXTENSIONS = {
        ".csv", ".doc", ".docx", ".odp", ".ods", ".odt", ".ppt", ".pptx",
        ".rtf", ".txt", ".xls", ".xlsx",
    }
    ARCHIVE_EXTENSIONS = {".7z", ".rar", ".zip"}
    ALLOWED_EXTENSIONS = (
        IMAGE_EXTENSIONS
        | VIDEO_EXTENSIONS
        | AUDIO_EXTENSIONS
        | DOCUMENT_EXTENSIONS
        | ARCHIVE_EXTENSIONS
        | {".pdf"}
    )
    MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024

    class Meta:
        model = MethodicalManualDocument
        fields = [
            "id",
            "subject",
            "title",
            "file",
            "fileUrl",
            "originalName",
            "previewHtml",
            "content",
            "kind",
            "createdAt",
        ]
        read_only_fields = ["id", "subject"]
        extra_kwargs = {
            "file": {"write_only": True, "required": False, "allow_null": True},
            "content": {"required": False, "allow_blank": True},
        }

    def validate_title(self, value):
        title = value.strip()
        if not title:
            raise serializers.ValidationError("Укажите название документа.")
        return title

    def validate_file(self, value):
        extension = Path(value.name).suffix.lower()
        if extension not in self.ALLOWED_EXTENSIONS:
            raise serializers.ValidationError(
                "Этот формат не поддерживается. Загрузите документ, PDF, изображение, аудио, видео или архив."
            )
        if value.size > self.MAX_FILE_SIZE:
            raise serializers.ValidationError("Размер файла не должен превышать 5 ГБ.")
        value.preview_html = ""
        if extension == ".doc":
            return "doc"
        if extension == ".docx":
            try:
                value.preview_html = extract_docx_preview(value)
            except DocxPreviewError as error:
                raise serializers.ValidationError(str(error)) from error
        return value

    def validate(self, attrs):
        content = str(attrs.get("content") or "").strip()
        uploaded_file = attrs.get("file")
        if not content and not uploaded_file:
            raise serializers.ValidationError(
                "Введите текст материала или выберите файл."
            )
        attrs["content"] = content
        return attrs

    def get_fileUrl(self, document):
        if not document.file:
            return ""
        request = self.context.get("request")
        return request.build_absolute_uri(document.file.url) if request else document.file.url

    def get_kind(self, document):
        if not document.file:
            return "text"
        extension = Path(document.original_name or document.file.name).suffix.lower()
        if extension == ".doc":
            return "doc"
        if extension == ".docx":
            return "docx"
        if extension == ".pdf":
            return "pdf"
        if extension in self.IMAGE_EXTENSIONS:
            return "image"
        if extension in self.VIDEO_EXTENSIONS:
            return "video"
        if extension in self.AUDIO_EXTENSIONS:
            return "audio"
        if extension in self.ARCHIVE_EXTENSIONS:
            return "archive"
        return "document"

    def create(self, validated_data):
        uploaded_file = validated_data.get("file")
        if uploaded_file:
            validated_data["original_name"] = uploaded_file.name
            validated_data["preview_html"] = getattr(uploaded_file, "preview_html", "")
        else:
            validated_data["original_name"] = ""
            validated_data["preview_html"] = ""
        return super().create(validated_data)
