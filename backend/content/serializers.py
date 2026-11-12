from pathlib import Path

from content.constants import MODULE_BANNER_VIDEO_EXTENSIONS, MODULE_TEMPLATE_IMAGE_EXTENSIONS


def module_template_payload(item, request):
    extension = Path(item.file.name).suffix.lower()
    return {
        "id": item.id,
        "moduleKey": item.module_key,
        "title": item.title,
        "fileUrl": request.build_absolute_uri(item.file.url),
        "kind": "image" if extension in MODULE_TEMPLATE_IMAGE_EXTENSIONS else "pdf",
        "uploadedBy": item.uploaded_by.full_name if item.uploaded_by else "",
        "createdAt": item.created_at,
    }


def module_banner_payload(item, request):
    files = [item.file, *(media.file for media in item.additional_media.all())]
    media = [
        {
            "id": "primary" if index == 0 else item.additional_media.all()[index - 1].id,
            "fileUrl": request.build_absolute_uri(stored_file.url),
            "kind": "video" if Path(stored_file.name).suffix.lower() in MODULE_BANNER_VIDEO_EXTENSIONS else "image",
        }
        for index, stored_file in enumerate(files)
    ]
    return {
        "id": item.id,
        "moduleKey": item.module_key,
        "title": item.title,
        "description": item.description,
        "fileUrl": media[0]["fileUrl"],
        "kind": media[0]["kind"],
        "media": media,
        "uploadedBy": item.uploaded_by.full_name if item.uploaded_by else "",
        "createdAt": item.created_at,
    }
