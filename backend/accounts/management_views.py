from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from accounts.permissions import IsActiveUser
from accounts.models import User
from accounts.management_scope import subordinate_users, MANAGEMENT_UNITS
from accounts.serializers import UserPublicSerializer
from submissions.models import ThematicAccountSubmission
from submissions.serializers import thematic_submission_metadata, thematic_submission_payload
from messaging.models import AdminChatMessage
from messaging.serializers import AdminChatMessageSerializer

class ManagementOverviewView(APIView):
    permission_classes = [IsActiveUser]

    def get(self, request):
        if request.user.role not in {User.Role.MANAGEMENT, User.Role.REGIONAL} or request.user.region not in MANAGEMENT_UNITS:
            raise PermissionDenied()
        users = subordinate_users(request.user)
        documents = ThematicAccountSubmission.objects.filter(Q(sender__in=users)|Q(sender=request.user)).select_related('sender','edit_request').prefetch_related('reads','revisions__reads','revisions__hidden_by')
        document_id = request.query_params.get('documentId')
        if document_id:
            if not document_id.isdigit(): raise ValidationError('Invalid document ID')
            document = documents.filter(pk=int(document_id)).first()
            if not document: raise PermissionDenied()
            return Response(thematic_submission_payload(document, request.user))
        messages = AdminChatMessage.objects.filter(sender__in=users,recipient__in=users,is_broadcast=False).select_related('sender','recipient').order_by('-created_at','-id')[:100]
        # Audit reads never alter participants' delivery/read receipts.
        return Response({
            'units': MANAGEMENT_UNITS.get(request.user.region, ()),
            'users': UserPublicSerializer(users, many=True, context={'request':request}).data,
            'documents': [thematic_submission_metadata(d, request.user) for d in documents.order_by('-pk')],
            'messages': AdminChatMessageSerializer(messages,many=True,context={'request':request}).data,
        })
