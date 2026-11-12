from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIRequestFactory,force_authenticate
from accounts.models import User,ResultDocumentSample
from submissions.sample_views import ResultSamplesView,ResultSampleDetailView
class SamplePermissionsTests(TestCase):
 def test_outpost_read_only_and_unit_scope(self):
  factory=APIRequestFactory()
  user=User.objects.create(username='sample-outpost',email='sample@local.test',role='outpost',status='active',region='2024')
  own=ResultDocumentSample.objects.create(period_key='p',unit_number='2024',original_name='own.pdf',file='samples/own.pdf',uploaded_by=user)
  ResultDocumentSample.objects.create(period_key='p',unit_number='2021',original_name='foreign.pdf',file='samples/foreign.pdf',uploaded_by=user)
  ResultDocumentSample.objects.create(period_key='p',unit_number='',original_name='global.pdf',file='samples/global.pdf',uploaded_by=user)
  req=factory.get('/',{'period':'p'});force_authenticate(req,user);res=ResultSamplesView.as_view()(req)
  self.assertEqual({item['name'] for item in res.data},{'own.pdf','global.pdf'})
  req=factory.post('/',{'period':'p','file':SimpleUploadedFile('test.pdf',b'%PDF')});force_authenticate(req,user);self.assertEqual(ResultSamplesView.as_view()(req).status_code,403)
  req=factory.delete('/');force_authenticate(req,user);self.assertEqual(ResultSampleDetailView.as_view()(req,pk=own.pk).status_code,403)
