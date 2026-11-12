from rest_framework.test import APITestCase
from django.urls import reverse
from accounts.models import User
from submissions.models import SubmissionArchiveCopy
class UnitArchiveTests(APITestCase):
 def test_unit_archive_is_scoped_and_private_drafts_excluded(self):
  unit=User.objects.create_user(username='unitarchive',email='unitarchive@test.local',password='test',role=User.Role.REGIONAL,status=User.Status.ACTIVE,region='2021')
  def snapshot(number,source):
   return SubmissionArchiveCopy.objects.create(source_submission_id=source,sender_id_snapshot=999,unit_number=number,document_title='Journal',section_slug='combat-training-personnel-journal',period_slug='journal:subject:1',year=2026,table_data={'body':'saved'})
  allowed=snapshot('2021',10);foreign=snapshot('2023',11);private=snapshot('2021',0)
  self.client.force_authenticate(unit)
  url=reverse('submission-archive-list')
  result=self.client.get(url,{'scope':'unit'})
  self.assertEqual([item['id'] for item in result.data],[allowed.pk])
  self.assertEqual(self.client.get(url,{'scope':'unit','copyId':foreign.pk}).data,[])
  self.assertEqual(self.client.get(url,{'scope':'unit','copyId':private.pk}).data,[])
  self.assertEqual(self.client.get(url,{'scope':'admin'}).status_code,403)
  self.assertEqual(self.client.get(url,{'scope':'unit','copyId':allowed.pk}).data[0]['table'],{'body':'saved'})
