from pathlib import Path

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsActiveUser, IsAdminRole
from content.constants import (
    MODULE_BANNER_ALLOWED_EXTENSIONS,
    MODULE_BANNER_KEYS,
    MODULE_BANNER_MAX_COUNT,
    MODULE_BANNER_MAX_MEDIA_COUNT,
    MODULE_BANNER_MAX_SIZE,
    MODULE_TEMPLATE_ALLOWED_EXTENSIONS,
    MODULE_TEMPLATE_KEYS,
    MODULE_TEMPLATE_MAX_SIZE,
    MODULE_TEMPLATE_PRIMARY_ONLY_KEYS,
)
from content.models import ModuleBanner, ModuleBannerMedia, ModuleTemplate
from content.serializers import module_banner_payload, module_template_payload


class ModuleBannerListCreateView(APIView):
    permission_classes = [IsActiveUser]

    def get_module_key(self, request):
        module_key = str(
            request.query_params.get("moduleKey") or request.data.get("moduleKey") or ""
        ).strip()
        if module_key not in MODULE_BANNER_KEYS:
            raise ValidationError({"moduleKey": "Белгисиз бөлүм."})
        return module_key

    def get(self, request):
        module_key = self.get_module_key(request)
        items = ModuleBanner.objects.filter(module_key=module_key).select_related("uploaded_by").prefetch_related("additional_media")
        return Response([module_banner_payload(item, request) for item in items])

    @transaction.atomic
    def post(self, request):
        if request.user.role != User.Role.ADMIN:
            raise PermissionDenied("Баннерди администратор гана жарыялай алат.")

        module_key = self.get_module_key(request)
        if ModuleBanner.objects.filter(module_key=module_key).count() >= MODULE_BANNER_MAX_COUNT:
            raise ValidationError({"moduleKey": "Бир бөлүмгө эң көп дегенде 3 баннер жарыялоого болот."})
        uploaded_files = request.FILES.getlist("files") or request.FILES.getlist("file")
        if not uploaded_files:
            raise ValidationError({"file": "Сүрөт же видео тандаңыз."})
        if len(uploaded_files) > MODULE_BANNER_MAX_MEDIA_COUNT:
            raise ValidationError({"file": "Бир баннерге эң көп дегенде 10 файл кошууга болот."})
        for uploaded_file in uploaded_files:
            extension = Path(uploaded_file.name).suffix.lower()
            if extension not in MODULE_BANNER_ALLOWED_EXTENSIONS:
                raise ValidationError({"file": "JPG, PNG, GIF, WEBP, BMP, MP4, WEBM, MOV, M4V же OGV файлдарын жүктөңүз."})
            if uploaded_file.size > MODULE_BANNER_MAX_SIZE:
                raise ValidationError({"file": "Ар бир файлдын көлөмү 100 МБдан ашпашы керек."})

        title = str(request.data.get("title") or "").strip()
        description = str(request.data.get("description") or "").strip()
        if not title:
            raise ValidationError({"title": "Баннердин аталышын жазыңыз."})

        item = ModuleBanner.objects.create(
            module_key=module_key,
            title=title[:255],
            description=description,
            file=uploaded_files[0],
            uploaded_by=request.user,
        )
        ModuleBannerMedia.objects.bulk_create([
            ModuleBannerMedia(banner=item, file=uploaded_file)
            for uploaded_file in uploaded_files[1:]
        ])
        return Response(module_banner_payload(item, request), status=status.HTTP_201_CREATED)


class ModuleBannerDetailView(APIView):
    permission_classes = [IsAdminRole]

    @transaction.atomic
    def patch(self, request, pk):
        item = get_object_or_404(ModuleBanner.objects.prefetch_related("additional_media"), pk=pk)
        title = str(request.data.get("title", item.title)).strip()
        description = str(request.data.get("description", item.description)).strip()
        if not title:
            raise ValidationError({"title": "Баннердин аталышын жазыңыз."})

        uploaded_files = request.FILES.getlist("files") or request.FILES.getlist("file")
        current_count = 1 + item.additional_media.count()
        if current_count + len(uploaded_files) > MODULE_BANNER_MAX_MEDIA_COUNT:
            raise ValidationError({"file": "Бир баннерге эң көп дегенде 10 файл кошууга болот."})
        for uploaded_file in uploaded_files:
            if Path(uploaded_file.name).suffix.lower() not in MODULE_BANNER_ALLOWED_EXTENSIONS:
                raise ValidationError({"file": "Сүрөт же видео форматындагы файлды тандаңыз."})
            if uploaded_file.size > MODULE_BANNER_MAX_SIZE:
                raise ValidationError({"file": "Ар бир файлдын көлөмү 100 МБдан ашпашы керек."})

        item.title = title[:255]
        item.description = description
        item.save(update_fields=("title", "description"))
        ModuleBannerMedia.objects.bulk_create([
            ModuleBannerMedia(banner=item, file=uploaded_file)
            for uploaded_file in uploaded_files
        ])
        item = ModuleBanner.objects.select_related("uploaded_by").prefetch_related("additional_media").get(pk=item.pk)
        return Response(module_banner_payload(item, request))

    def delete(self, request, pk):
        item = get_object_or_404(ModuleBanner.objects.prefetch_related("additional_media"), pk=pk)
        stored_file = item.file
        additional_files = [media.file for media in item.additional_media.all()]
        item.delete()
        if stored_file:
            stored_file.delete(save=False)
        for additional_file in additional_files:
            additional_file.delete(save=False)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ModuleTemplateListCreateView(APIView):
    permission_classes = [IsActiveUser]

    def get_module_key(self, request):
        module_key = str(
            request.query_params.get("moduleKey") or request.data.get("moduleKey") or ""
        ).strip()
        if module_key not in MODULE_TEMPLATE_KEYS:
            raise ValidationError({"moduleKey": "Неизвестный раздел."})
        return module_key

    def get(self, request):
        module_key = self.get_module_key(request)
        items = ModuleTemplate.objects.filter(module_key=module_key).select_related("uploaded_by")
        return Response([module_template_payload(item, request) for item in items])

    def post(self, request):
        if request.user.role != User.Role.ADMIN:
            raise PermissionDenied("Загружать Үлгү может только администратор.")
        module_key = self.get_module_key(request)
        if module_key in MODULE_TEMPLATE_PRIMARY_ONLY_KEYS and not request.user.is_superuser:
            raise PermissionDenied("В этот раздел загружать Үлгү может только главный администратор.")

        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            raise ValidationError({"file": "Выберите PDF-файл или фотографию."})
        if Path(uploaded_file.name).suffix.lower() not in MODULE_TEMPLATE_ALLOWED_EXTENSIONS:
            raise ValidationError({"file": "Разрешены PDF и изображения JPG, PNG, GIF, WEBP или BMP."})
        if uploaded_file.size > MODULE_TEMPLATE_MAX_SIZE:
            raise ValidationError({"file": "Размер одного файла не должен превышать 50 МБ."})

        title = str(request.data.get("title") or "").strip()
        if not title:
            raise ValidationError({"title": "Укажите название."})
        item = ModuleTemplate.objects.create(
            module_key=module_key,
            title=title[:255],
            file=uploaded_file,
            uploaded_by=request.user,
        )
        return Response(module_template_payload(item, request), status=status.HTTP_201_CREATED)


class ModuleTemplateDetailView(APIView):
    permission_classes = [IsAdminRole]

    def delete(self, request, pk):
        item = get_object_or_404(ModuleTemplate, pk=pk)
        if item.module_key in MODULE_TEMPLATE_PRIMARY_ONLY_KEYS and not request.user.is_superuser:
            raise PermissionDenied("Удалять Үлгү из этого раздела может только главный администратор.")
        stored_file = item.file
        item.delete()
        if stored_file:
            stored_file.delete(save=False)
        return Response(status=status.HTTP_204_NO_CONTENT)
