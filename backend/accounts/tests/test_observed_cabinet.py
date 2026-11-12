from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken
from accounts.models import User
from messaging.models import AdminChatMessage

class ObservedCabinetTests(APITestCase):
 def setUp(self):
  def make(name,role,unit):
   return User.objects.create_user(username=name,email=name+'@test.local',password='test',role=role,region=unit,status=User.Status.ACTIVE)
  self.actor=make('observer',User.Role.MANAGEMENT,'2022')
  self.unit=make('observed',User.Role.REGIONAL,'2021')
  self.outpost=make('outpost',User.Role.OUTPOST,'2021')
  self.message=AdminChatMessage.objects.create(sender=self.outpost,recipient=self.unit,body='unread')
  self.client.credentials(HTTP_AUTHORIZATION='Bearer '+str(AccessToken.for_user(self.actor)),HTTP_X_OBSERVE_UNIT='2021')
 def test_full_cabinet_uses_target_without_changing_actor(self):
  response=self.client.get(reverse('dashboard-regional'))
  self.assertEqual(response.status_code,200)
  self.assertEqual(response.data['observedUser']['id'],self.unit.id)
  self.assertIn('modules',response.data)
  self.assertEqual(response.renderer_context['request'].observer.pk,self.actor.pk)
 def test_every_mutation_denied(self):
  for method in ['post','put','patch','delete']:
   response=getattr(self.client,method)(reverse('admin-chat-messages'),{'recipientId':self.outpost.pk,'body':'forged'},format='json')
   self.assertEqual(response.status_code,403)
  self.assertEqual(AdminChatMessage.objects.count(),1)
 def test_audit_does_not_mark_read(self):
  response=self.client.get(reverse('admin-chat-messages'),{'user_id':self.outpost.pk})
  self.assertEqual(response.status_code,200)
  self.message.refresh_from_db();self.assertFalse(self.message.is_read)
 def test_out_of_scope_and_identity_endpoint_denied(self):
  self.client.credentials(HTTP_AUTHORIZATION='Bearer '+str(AccessToken.for_user(self.actor)),HTTP_X_OBSERVE_UNIT='2030')
  self.assertEqual(self.client.get(reverse('dashboard-regional')).status_code,403)
  self.client.credentials(HTTP_AUTHORIZATION='Bearer '+str(AccessToken.for_user(self.outpost)),HTTP_X_OBSERVE_UNIT='2021')
  self.assertEqual(self.client.get(reverse('dashboard-regional')).status_code,403)
