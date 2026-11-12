from django.urls import reverse
from rest_framework.test import APITestCase
from accounts.models import User
from submissions.models import ThematicAccountSubmission

class MemoLetterAuditTests(APITestCase):
    def setUp(self):
        def make(name, role, region):
            return User.objects.create_user(username=name+'@test.local',email=name+'@test.local',password='test-only',role=role,status=User.Status.ACTIVE,region=region)
        self.admin=make('audit-admin',User.Role.ADMIN,'')
        self.unit=make('audit-unit',User.Role.REGIONAL,'2021')
        self.other=make('audit-other',User.Role.REGIONAL,'2027')
        self.outpost=make('audit-outpost',User.Role.OUTPOST,'2021')
        self.document=ThematicAccountSubmission.objects.create(sender=self.outpost,document_title='Memo test',unit_number='2021',outpost_name='Test outpost',section_slug='memo-letter',period_slug='test',table_data={'body':'private report'})
        self.url=reverse('thematic-account-submission-list')
        self.detail=reverse('thematic-account-submission-detail',kwargs={'pk':self.document.id})

    def test_admin_read_is_private_and_does_not_mark_unit_read(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.patch(self.detail,{},format='json').status_code,200)
        self.assertTrue(self.client.get(self.url,{'submissionId':self.document.id}).data[0]['isRead'])
        self.client.force_authenticate(self.unit)
        self.assertFalse(self.client.get(self.url,{'submissionId':self.document.id}).data[0]['isRead'])
        self.client.force_authenticate(self.outpost)
        payload=self.client.get(self.url,{'submissionId':self.document.id}).data[0]
        self.assertFalse(payload['isRead'])
        self.assertNotIn('readBy',payload)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(self.url,{'submissionId':self.document.id}).data,[])
        self.assertEqual(self.client.patch(self.detail,{},format='json').status_code,403)

    def test_index_is_lightweight_and_does_not_change_read_state(self):
        self.client.force_authenticate(self.admin)
        response=self.client.get(self.url,{'sectionId':'memo-letter','metadata':'1','paged':'1'})
        self.assertEqual(response.status_code,200)
        item=response.data['results'][0]
        self.assertEqual(item['unitNumber'],'2021')
        self.assertNotIn('table',item)
        self.assertNotIn('revisions',item)
        self.assertFalse(item['isRead'])
        full=self.client.get(self.url,{'submissionId':self.document.id}).data[0]
        self.assertEqual(full['table'],{'body':'private report'})
        self.assertFalse(full['isRead'])
