from django.urls import reverse
from rest_framework.test import APITestCase
from accounts.models import User
class UserPagingTests(APITestCase):
 def test_ten_at_a_time_and_search_outside_first_page(self):
  admin=User.objects.create_user(username='admin@test.local',email='admin@test.local',role=User.Role.ADMIN,password='test')
  User.objects.bulk_create([User(username=f'outpost{i}',email=f'outpost{i}@test.local',role=User.Role.OUTPOST,status=User.Status.ACTIVE,full_name=f'Test {i}',region='2021') for i in range(23)])
  self.client.force_authenticate(admin)
  url=reverse('admin-users')
  first=self.client.get(url,{'paged':'1','role':'outpost'})
  self.assertEqual(len(first.data['results']),10)
  second=self.client.get(url,{'paged':'1','role':'outpost','offset':first.data['nextOffset']})
  self.assertEqual(len(second.data['results']),10)
  self.assertFalse(set(u['id'] for u in first.data['results']) & set(u['id'] for u in second.data['results']))
  found=self.client.get(url,{'paged':'1','role':'outpost','search':'outpost0@'})
  self.assertEqual(found.data['count'],1)
