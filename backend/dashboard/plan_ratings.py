from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from accounts.models import User
from accounts.permissions import IsActiveUser
from accounts.outposts import format_outpost_name
from submissions.models import RatingPlanItem, ThematicAccountSubmission

class PlanSerializer(serializers.ModelSerializer):
    assigneeName = serializers.CharField(source='assignee.full_name', read_only=True)
    class Meta:
        model = RatingPlanItem
        fields = ['id','assignee','assigneeName','title','section_slug','starts_at','deadline','status','returned_once','submission']
        read_only_fields = ['status','returned_once','submission']
    def validate(self, data):
        if data['deadline'] <= data['starts_at']:
            raise serializers.ValidationError('Срок должен быть позже начала периода.')
        if data['assignee'].role not in ['regional','outpost']:
            raise serializers.ValidationError('План назначается части или заставе.')
        return data

def visible_plans(user):
    qs=RatingPlanItem.objects.select_related('assignee','submission')
    if user.role=='admin': return qs
    if user.role=='regional': return qs.filter(assignee__region=user.region)
    return qs.filter(assignee=user)

class RatingPlanView(APIView):
    permission_classes=[IsActiveUser]
    def get(self,request):
        plans=visible_plans(request.user).order_by('-deadline','id')
        targets=User.objects.filter(status=User.Status.ACTIVE,role__in=['regional','outpost']).order_by('region','full_name') if request.user.role=='admin' else User.objects.none()
        return Response({'items':PlanSerializer(plans,many=True).data,'targets':[{'id':u.id,'label':f'{u.region} · {u.outpost_name or u.full_name} · {u.email}'} for u in targets]})
    def post(self,request):
        if request.user.role!='admin': raise PermissionDenied()
        serializer=PlanSerializer(data=request.data);serializer.is_valid(raise_exception=True)
        serializer.save(created_by=request.user)
        return Response(serializer.data,status=201)

class RatingPlanReviewView(APIView):
    permission_classes=[IsActiveUser]
    def get(self,request,pk):
        plan=get_object_or_404(visible_plans(request.user),pk=pk)
        docs=ThematicAccountSubmission.objects.filter(sender=plan.assignee,section_slug=plan.section_slug,created_at__gte=plan.starts_at).order_by('-created_at')
        return Response([{'id':d.id,'title':d.document_title,'sentAt':d.created_at,'table':d.table_data} for d in docs])
    def post(self,request,pk):
        plan=get_object_or_404(visible_plans(request.user),pk=pk)
        user=request.user
        if not (user.role=='admin' or (user.role=='regional' and plan.assignee.role=='outpost' and plan.assignee.region==user.region)):
            raise PermissionDenied()
        if plan.assignee_id==user.id: raise PermissionDenied('Нельзя принимать собственные документы.')
        status=request.data.get('status')
        if status not in ['accepted','returned']: raise ValidationError('Выберите решение.')
        doc=get_object_or_404(ThematicAccountSubmission,pk=request.data.get('submission'),sender=plan.assignee,section_slug=plan.section_slug,created_at__gte=plan.starts_at)
        if RatingPlanItem.objects.filter(submission=doc).exclude(pk=plan.pk).exists(): raise ValidationError('Документ уже учтён в другом пункте плана.')
        plan.submission=doc;plan.status=status;plan.returned_once=plan.returned_once or status=='returned' or doc.is_corrected
        plan.reviewed_by=user;plan.reviewed_at=timezone.now();plan.save()
        return Response(PlanSerializer(plan).data)

def apply_plan_ratings(ratings, outposts, start, end, period):
    plans=RatingPlanItem.objects.select_related('assignee','submission').all()
    if period!='all': plans=plans.filter(deadline__gte=start,deadline__lt=end)
    plans=list(plans);now=timezone.now()
    for entity in [*ratings.values(),*outposts.values()]:
        is_unit='unitNumber' in entity
        own=[p for p in plans if (str(p.assignee.region)==str(entity.get('unitNumber')) if is_unit else any(p.assignee_id==u for u in entity.get('_plan_users',[])))]
        eligible=[p for p in own if p.deadline<=now or (p.status=='accepted' and p.submission_id and p.reviewed_at and p.submission.updated_at<=p.reviewed_at)]
        accepted=[p for p in eligible if p.status=='accepted' and p.submission_id and p.reviewed_at and p.submission.updated_at<=p.reviewed_at]
        count=len(eligible)
        entity['hasRatingData']=bool(count);entity['plannedCount']=count;entity['acceptedCount']=len(accepted);entity['waitingCount']=len(own)-count
        entity['documentScore']=round(len(accepted)/count*100,1) if count else 0
        entity['deadlineScore']=round(sum(p.submission.created_at<=p.deadline for p in accepted)/count*100,1) if count else 0
        entity['qualityScore']=round(sum(not p.returned_once for p in accepted)/count*100,1) if count else 0
        entity['activityScore']=0;entity['criteriaPenalty']=0;entity['unitBonus']=0
        entity['score']=round(entity['documentScore']*.6+entity['deadlineScore']*.3+entity['qualityScore']*.1,1)
        entity['rawScore']=entity['baseScore']=entity['score'];entity['failedCriteria']=0
        entity.pop('_plan_users',None)
