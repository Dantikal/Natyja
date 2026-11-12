from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsAdminRole
from methodical.models import MethodicalManualDocument, MethodicalManualSubject
from methodical.serializers import (
    MethodicalManualDocumentSerializer,
    MethodicalManualSubjectSerializer,
)
from methodical.services import methodical_manual_subject_queryset


class MethodicalManualSubjectListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [IsActiveUser()]
        return [IsAdminRole()]

    def get(self, request):
        collection = request.query_params.get(
            "collection",
            MethodicalManualSubject.Collection.METHODICAL_MANUALS,
        )
        subjects = methodical_manual_subject_queryset(collection)
        return Response(MethodicalManualSubjectSerializer(subjects, many=True).data)

    def post(self, request):
        collection = request.data.get(
            "collection",
            MethodicalManualSubject.Collection.METHODICAL_MANUALS,
        )
        if (
            collection == MethodicalManualSubject.Collection.METHODICAL_MANUALS
            and not request.user.is_superuser
        ):
            raise PermissionDenied("Изменять методические пособия может только главный администратор.")
        serializer = MethodicalManualSubjectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        subject = serializer.save()
        return Response(
            MethodicalManualSubjectSerializer(subject).data,
            status=201,
        )


class MethodicalManualSubjectDetailView(APIView):
    permission_classes = [IsAdminRole]

    def get_object(self, pk):
        return get_object_or_404(MethodicalManualSubject, pk=pk)

    def patch(self, request, pk):
        subject = self.get_object(pk)
        if (
            subject.collection == MethodicalManualSubject.Collection.METHODICAL_MANUALS
            and not request.user.is_superuser
        ):
            raise PermissionDenied("Изменять методические пособия может только главный администратор.")
        serializer = MethodicalManualSubjectSerializer(
            subject,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        subject = serializer.save()
        return Response(MethodicalManualSubjectSerializer(subject).data)

    def delete(self, request, pk):
        subject = self.get_object(pk)
        if (
            subject.collection == MethodicalManualSubject.Collection.METHODICAL_MANUALS
            and not request.user.is_superuser
        ):
            raise PermissionDenied("Изменять методические пособия может только главный администратор.")
        subject.delete()
        return Response(status=204)


class MethodicalManualDocumentListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [IsActiveUser()]
        return [IsAdminRole()]

    def get_subject(self, subject_pk):
        return get_object_or_404(MethodicalManualSubject, pk=subject_pk, is_active=True)

    def get(self, request, subject_pk):
        subject = self.get_subject(subject_pk)
        documents = MethodicalManualDocument.objects.filter(subject=subject)
        return Response(
            MethodicalManualDocumentSerializer(
                documents,
                many=True,
                context={"request": request},
            ).data
        )

    def post(self, request, subject_pk):
        subject = self.get_subject(subject_pk)
        if (
            subject.collection == MethodicalManualSubject.Collection.METHODICAL_MANUALS
            and not request.user.is_superuser
        ):
            raise PermissionDenied("Изменять методические пособия может только главный администратор.")
        if (
            subject.collection == MethodicalManualSubject.Collection.METHODICAL_MANUALS
            and subject.parent_id is None
            and subject.title in ("Электрондук план-конспектилер", "Насааттамалар, нускамалар жана жоболор")
        ):
            raise ValidationError({"subject": (
                "Материалды башкармалыктын ичине кошуңуз."
                if subject.title == "Насааттамалар, нускамалар жана жоболор"
                else "Материалды предметтин ичине кошуңуз."
            )})
        serializer = MethodicalManualDocumentSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        document = serializer.save(subject=subject, uploaded_by=request.user)
        return Response(
            MethodicalManualDocumentSerializer(
                document,
                context={"request": request},
            ).data,
            status=201,
        )


class MethodicalManualDocumentDetailView(APIView):
    permission_classes = [IsAdminRole]

    def delete(self, request, subject_pk, pk):
        document = get_object_or_404(
            MethodicalManualDocument,
            pk=pk,
            subject_id=subject_pk,
        )
        if (
            document.subject.collection == MethodicalManualSubject.Collection.METHODICAL_MANUALS
            and not request.user.is_superuser
        ):
            raise PermissionDenied("Изменять методические пособия может только главный администратор.")
        stored_file = document.file
        document.delete()
        if stored_file:
            stored_file.delete(save=False)
        return Response(status=204)


class MethodicalWordPreviewView(APIView):
    permission_classes = [IsActiveUser]

    def get(self, request, subject_pk, pk):
        from pathlib import Path
        from django.http import FileResponse
        from methodical.legacy_preview import legacy_word_preview, office_pdf_preview, OFFICE_PREVIEW_EXTENSIONS, LegacyPreviewError
        document = get_object_or_404(MethodicalManualDocument, pk=pk, subject_id=subject_pk, subject__is_active=True)
        extension = Path(document.original_name or document.file.name).suffix.lower()
        if not document.file or extension not in OFFICE_PREVIEW_EXTENSIONS | {".doc"}:
            raise ValidationError("Формат не поддерживает преобразование Office.")
        try:
            preview = legacy_word_preview(document.file) if extension == ".doc" else office_pdf_preview(document.file)
        except LegacyPreviewError as error:
            return Response({"detail": str(error)}, status=503)
        response = FileResponse(preview.open("rb"), content_type="application/pdf" if preview.suffix == ".pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document", as_attachment=False, filename=preview.name)
        response["Cache-Control"] = "private, no-store"
        return response


class WatermarkedDocumentView(APIView):
    permission_classes = [IsActiveUser]
    def get(self,request,subject_pk,pk):
        from pathlib import Path
        from django.http import FileResponse
        from methodical.legacy_preview import office_pdf_preview, LegacyPreviewError, OFFICE_PREVIEW_EXTENSIONS
        from methodical.watermarks import stamp_pdf
        document=get_object_or_404(MethodicalManualDocument,pk=pk,subject_id=subject_pk,subject__is_active=True)
        if not document.file: raise ValidationError('У документа нет файла.')
        extension=Path(document.file.name).suffix.lower()
        try:
            if extension=='.pdf': source=document.file.path
            elif extension in OFFICE_PREVIEW_EXTENSIONS|{'.doc','.docx'}: source=office_pdf_preview(document.file)
            else: raise ValidationError('Водяной знак доступен для PDF и документов Office.')
            result=stamp_pdf(source,getattr(request,"observer",request.user))
        except LegacyPreviewError as error: return Response({'detail':str(error)},status=503)
        except (ValueError, OSError) as error: return Response({'detail':'Не удалось подготовить копию с водяным знаком.'},status=503)
        response=FileResponse(result,content_type='application/pdf',as_attachment=True,filename=Path(document.original_name or 'document').stem+'-marked.pdf')
        response['Cache-Control']='private, no-store';response['X-Content-Type-Options']='nosniff'
        return response
