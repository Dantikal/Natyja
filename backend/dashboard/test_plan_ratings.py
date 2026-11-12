from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APITestCase
from accounts.models import User
from submissions.models import RatingPlanItem, ThematicAccountSubmission
from dashboard.plan_ratings import apply_plan_ratings

class PlanRatingTests(APITestCase):
 def setUp(self):
  self.admin=User.objects.create_user(username='admin-plan',email='admin-plan@local.test',password='test',role='admin',status='active')
  self.unit=User.objects.create_user(username='unit-plan',email='unit-plan@local.test',password='test',role='regional',status='active',region='2021')
  self.now=timezone.now()
 def score(self):
  units={'2021':{'unitNumber':'2021'}}
  apply_plan_ratings(units,{},self.now-timedelta(days=30),self.now+timedelta(days=30),'all')
  return units['2021']
 def plan(self,**values):
  return RatingPlanItem.objects.create(assignee=self.unit,title='Required',section_slug='thematic-account',starts_at=self.now-timedelta(days=5),deadline=self.now-timedelta(days=1),created_by=self.admin,**values)
 def test_missing_plan_and_future_not_penalized(self):
  self.assertFalse(self.score()['hasRatingData'])
  p=self.plan();p.deadline=self.now+timedelta(days=2);p.save()
  self.assertFalse(self.score()['hasRatingData']);self.assertEqual(self.score()['waitingCount'],1)
 def test_accepted_late_and_returned_quality(self):
  doc=ThematicAccountSubmission.objects.create(sender=self.unit,unit_number='2021',document_title='Required')
  self.plan(status='accepted',submission=doc,reviewed_at=timezone.now(),returned_once=True)
  result=self.score();self.assertEqual(result['documentScore'],100);self.assertEqual(result['deadlineScore'],0);self.assertEqual(result['qualityScore'],0);self.assertEqual(result['score'],60)
  ThematicAccountSubmission.objects.create(sender=self.unit,unit_number='2021',document_title='Duplicate')
  self.assertEqual(self.score()['score'],60)
 def test_outpost_cannot_review_or_create_plan(self):
  self.client.force_authenticate(self.unit)
  self.assertEqual(self.client.post('/api/dashboard/rating-plan/',{}).status_code,403)
  p=self.plan();doc=ThematicAccountSubmission.objects.create(sender=self.unit,unit_number='2021',document_title='Required')
  self.assertEqual(self.client.post(f'/api/dashboard/rating-plan/{p.id}/review/',{'submission':doc.id,'status':'accepted'}).status_code,403)
 def test_edit_after_acceptance_requires_new_review(self):
  doc=ThematicAccountSubmission.objects.create(sender=self.unit,unit_number='2021',document_title='Required')
  self.plan(status='accepted',submission=doc,reviewed_at=timezone.now())
  self.assertEqual(self.score()['acceptedCount'],1)
  doc.document_title='Changed';doc.save()
  self.assertEqual(self.score()['acceptedCount'],0)

 def test_full_score_and_unit_outpost_aggregation(self):
  outpost=User.objects.create_user(username='post-plan',email='post-plan@local.test',password='test',role='outpost',status='active',region='2021',outpost_name='Test')
  doc=ThematicAccountSubmission.objects.create(sender=outpost,unit_number='2021',document_title='Required')
  plan=self.plan(status='accepted',submission=doc,reviewed_at=timezone.now())
  plan.assignee=outpost;plan.deadline=self.now+timedelta(hours=1);plan.save()
  units={'2021':{'unitNumber':'2021'}};posts={1:{'outpostName':'Test','_plan_users':[outpost.id]}}
  apply_plan_ratings(units,posts,self.now,self.now,'all')
  self.assertEqual(units['2021']['score'],100);self.assertEqual(posts[1]['score'],100)
  self.assertEqual(units['2021']['unitBonus'],0)
