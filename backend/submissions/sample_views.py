from pathlib import Path
from django.db.models import Q
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from accounts.models import ResultDocumentSample
from accounts.permissions import IsActiveUser

def visible(user):
    qs=ResultDocumentSample.objects.all()
    return qs if user.role=='admin' else qs.filter(Q(unit_number='')|Q(unit_number=user.region))

def writable(user):
    if user.role not in ('admin','regional'):
        raise PermissionDenied('Застава может только просматривать и скачивать образцы.')

class ResultSamplesView(APIView):
    permission_classes=[IsActiveUser]
    def get(self,request):
        key=request.query_params.get('period','')
        return Response([{'id':item.pk,'name':item.original_name,'canDelete':request.user.role=='admin' or (request.user.role=='regional' and item.unit_number==request.user.region),'unit':item.unit_number} for item in visible(request.user).filter(period_key=key).order_by('-created_at')])
    def post(self,request):
        writable(request.user)
        file=request.FILES.get('file');key=request.data.get('period','')
        if not file or not key or len(key)>200:raise ValidationError('Укажите файл и раздел.')
        if Path(file.name).suffix.lower() not in ('.pdf','.doc','.docx','.png','.jpg','.jpeg','.webp') or file.size>20*1024*1024:raise ValidationError('Допустимы PDF, Word и фото до 20 МБ.')
        item=ResultDocumentSample.objects.create(period_key=key,unit_number='' if request.user.role=='admin' else request.user.region,original_name=Path(file.name).name[:255],file=file,uploaded_by=request.user)
        return Response({'id':item.pk,'name':item.original_name,'canDelete':True,'unit':item.unit_number},status=201)

class ResultSampleDetailView(APIView):
    permission_classes=[IsActiveUser]
    def get(self,request,pk):
        item=get_object_or_404(visible(request.user),pk=pk)
        return FileResponse(item.file.open('rb'),as_attachment=True,filename=item.original_name)
    def delete(self,request,pk):
        writable(request.user);item=get_object_or_404(visible(request.user),pk=pk)
        if request.user.role!='admin' and item.unit_number!=request.user.region:raise PermissionDenied('Общий образец может убрать только администратор.')
        item.delete();return Response(status=204)
