from django.urls import reverse
from rest_framework.test import APITestCase
from accounts.models import User
from messaging.models import AdminChatMessage
from submissions.models import ThematicAccountSubmission

class ManagementScopeTests(APITestCase):
 def setUp(self):
  def make(name,role,region):
   return User.objects.create_user(username=name,email=name+'@test.local',password='test',role=role,region=region,status=User.Status.ACTIVE)
  self.manager=make('manager',User.Role.MANAGEMENT,'2022')
  self.other=make('other-manager',User.Role.MANAGEMENT,'2027')
  self.unit=make('unit',User.Role.REGIONAL,'2021')
  self.outpost=make('outpost',User.Role.OUTPOST,'2021')
  self.external=make('external',User.Role.REGIONAL,'2030')
  self.doc=ThematicAccountSubmission.objects.create(sender=self.outpost,unit_number='2021',document_title='private',section_slug='memo-letter',table_data={'body':'test'})
  self.message=AdminChatMessage.objects.create(sender=self.outpost,recipient=self.unit,body='audit')
  self.url=reverse('management-overview')
 def test_scoped_read_only_audit(self):
  self.client.force_authenticate(self.manager)
  data=self.client.get(self.url).data
  self.assertEqual([d['id'] for d in data['documents']],[self.doc.pk])
  self.assertEqual([m['id'] for m in data['messages']],[self.message.pk])
  self.message.refresh_from_db();self.assertFalse(self.message.is_read)
  self.assertEqual(self.client.patch(reverse('thematic-account-submission-detail',kwargs={'pk':self.doc.pk}),{},format='json').status_code,403)
  self.assertEqual(self.client.post(reverse('thematic-account-submission-list'),{},format='json').status_code,403)
  self.assertEqual(self.client.get(reverse('admin-users')).status_code,403)
  self.client.force_authenticate(self.other)
  self.assertEqual(self.client.get(self.url).data['documents'],[])
  self.assertEqual(self.client.get(self.url,{'documentId':self.doc.pk}).status_code,403)
  self.client.force_authenticate(self.unit)
  self.assertEqual(self.client.get(self.url).status_code,403)
 def test_management_chat_scope(self):
  self.client.force_authenticate(self.manager)
  partners=self.client.get(reverse('chat-partners')).data
  self.assertIn(self.unit.pk,[u['id'] for u in partners])
  self.assertNotIn(self.external.pk,[u['id'] for u in partners])
  url=reverse('admin-chat-messages')
  self.assertEqual(self.client.post(url,{'recipientId':self.unit.pk,'body':'hello'},format='json').status_code,201)
  self.assertEqual(self.client.post(url,{'recipientId':self.external.pk,'body':'denied'},format='json').status_code,400)
  self.client.force_authenticate(self.unit)
  self.assertEqual(self.client.post(url,{'recipientId':self.manager.pk,'body':'reply'},format='json').status_code,201)

 def test_corrected_management_units(self):
  self.client.force_authenticate(self.manager)
  self.assertEqual(list(self.client.get(self.url).data['units']),['2021','2023'])
  from accounts.management_scope import subordinate_users
  unit2023=User.objects.create_user(username='unit2023',email='unit2023@test.local',password='test',role=User.Role.REGIONAL,region='2023',status=User.Status.ACTIVE)
  unit2022=User.objects.create_user(username='unit2022',email='unit2022@test.local',password='test',role=User.Role.REGIONAL,region='2022',status=User.Status.ACTIVE)
  self.assertTrue(subordinate_users(self.manager).filter(pk=unit2023.pk).exists())
  self.assertFalse(subordinate_users(self.manager).filter(pk=unit2022.pk).exists())
