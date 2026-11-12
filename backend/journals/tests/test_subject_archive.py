from rest_framework.test import APITestCase
from django.urls import reverse
from accounts.models import User
from journals.models import CombatTrainingJournalSubject
from submissions.models import SubmissionArchiveCopy, ThematicAccountSubmission

class SubjectArchiveTests(APITestCase):
 def setUp(self):
  self.admin=User.objects.create_superuser(username='subject-root',email='root@archive.test',password='test')
  self.admin.status=User.Status.ACTIVE;self.admin.save()
  self.other=User.objects.create_user(username='subject-other',email='other@archive.test',password='test',role=User.Role.OUTPOST,status=User.Status.ACTIVE,region='2021')
  self.subject=CombatTrainingJournalSubject.objects.create(title='Test',unit_number='2021')
  self.list=reverse('combat-training-journal-subject-list')
  self.url=reverse('combat-training-journal-subject-detail',kwargs={'pk':self.subject.pk})
  self.client.force_authenticate(self.admin)
 def test_soft_delete_date_visibility_and_restore(self):
  self.assertEqual(self.client.delete(self.url).status_code,204)
  self.subject.refresh_from_db();self.assertFalse(self.subject.is_active);self.assertIsNotNone(self.subject.deleted_at)
  self.assertEqual(self.client.get(self.list).data,[])
  deleted=self.client.get(self.list,{'deleted':1}).data
  self.assertEqual(deleted[0]['id'],self.subject.pk);self.assertFalse(deleted[0]['hasDocuments'])
  self.assertEqual(self.client.patch(self.url,{'restore':True},format='json').status_code,200)
  self.subject.refresh_from_db();self.assertTrue(self.subject.is_active);self.assertIsNone(self.subject.deleted_at)
 def test_empty_subject_only_can_be_purged_after_soft_delete(self):
  self.assertEqual(self.client.delete(self.url+'?permanent=1').status_code,400)
  self.client.delete(self.url)
  self.assertEqual(self.client.delete(self.url+'?permanent=1').status_code,204)
  self.assertFalse(CombatTrainingJournalSubject.objects.filter(pk=self.subject.pk).exists())
 def test_archived_document_blocks_purge_even_without_original(self):
  copy=SubmissionArchiveCopy.objects.create(source_submission_id=999,sender_id_snapshot=self.other.pk,unit_number='2021',period_slug=f'journal:subject:{self.subject.pk}',section_slug='combat-training-personnel-journal',document_title='Preserved',table_data={'body':'history'},year=2026)
  self.client.delete(self.url)
  self.assertEqual(self.client.get(self.list,{'deleted':1}).data[0]['hasDocuments'],True)
  self.assertEqual(self.client.delete(self.url+'?permanent=1').status_code,400)
  copy.refresh_from_db();self.assertEqual(copy.table_data,{'body':'history'})
 def test_current_document_blocks_purge_and_other_user_has_no_access(self):
  ThematicAccountSubmission.objects.create(sender=self.other,unit_number='2021',period_slug=f'journal:subject:{self.subject.pk}',document_title='Current')
  self.client.delete(self.url)
  self.assertEqual(self.client.delete(self.url+'?permanent=1').status_code,400)
  self.client.force_authenticate(self.other)
  self.assertEqual(self.client.get(self.list,{'deleted':1}).status_code,403)
  self.assertEqual(self.client.patch(self.url,{'restore':True},format='json').status_code,403)
