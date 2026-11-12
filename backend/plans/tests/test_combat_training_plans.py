from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import User


class CombatTrainingPlanApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="plan-admin@example.com",
            email="plan-admin@example.com",
            password="test-password",
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        self.outpost = User.objects.create_user(
            username="plan-outpost@example.com",
            email="plan-outpost@example.com",
            password="test-password",
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
            region="2021",
        )
        self.list_url = reverse("combat-training-plan-list")

    def test_admin_plan_is_visible_to_outpost_but_only_admin_can_change_it(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            self.list_url,
            {
                "title": "Февраль айынын иш планы",
                "layout": "plan",
                "data": {
                    "planRows": [
                        {"number": 1, "activity": "Сабак", "date": "2026-07-20"}
                    ]
                },
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        detail_url = reverse("combat-training-plan-detail", kwargs={"pk": response.data["id"]})

        self.client.force_authenticate(self.outpost)
        response = self.client.get(f"{self.list_url}?layout=plan")
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["planRows"][0]["activity"], "Сабак")
        self.assertEqual(response.data[0]["planRows"][0]["date"], "2026-07-20")
        self.assertEqual(
            self.client.patch(detail_url, {"data": {}}, format="json").status_code,
            403,
        )
        self.assertEqual(self.client.delete(detail_url).status_code, 403)

        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            detail_url,
            {"data": {"planRows": [{"number": 1, "activity": "Жаңыртылды"}]}},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["planRows"][0]["activity"], "Жаңыртылды")

    def test_outpost_cannot_create_plan(self):
        self.client.force_authenticate(self.outpost)
        response = self.client.post(
            self.list_url,
            {"title": "Тыюу салынган план", "layout": "plan", "data": {}},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_send_action_creates_bell_notification_until_section_is_opened(self):
        self.client.force_authenticate(self.admin)
        create_response = self.client.post(
            self.list_url,
            {
                "title": "Жаңыртыла турган план",
                "layout": "plan",
                "data": {"planRows": []},
            },
            format="json",
        )
        detail_url = reverse(
            "combat-training-plan-detail",
            kwargs={"pk": create_response.data["id"]},
        )

        self.client.force_authenticate(self.outpost)
        unread_url = reverse("combat-training-plan-unread-count")
        self.assertEqual(self.client.get(unread_url).data["unreadCount"], 0)

        self.client.force_authenticate(self.admin)
        self.client.patch(
            detail_url,
            {"data": {"planRows": [{"number": 1}], "sentAt": "2026-07-24T12:00:00Z"}},
            format="json",
        )

        self.client.force_authenticate(self.outpost)
        self.assertEqual(self.client.get(unread_url).data["unreadCount"], 1)
        read_response = self.client.post(reverse("combat-training-plan-read-all"))
        self.assertEqual(read_response.status_code, 200)
        self.assertEqual(self.client.get(unread_url).data["unreadCount"], 0)
