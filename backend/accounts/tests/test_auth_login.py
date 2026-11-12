from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import User


class LoginApiTests(APITestCase):
    def setUp(self):
        self.password = "test-password"
        self.user = User.objects.create_user(
            username="active-user@example.com",
            email="active-user@example.com",
            password=self.password,
            role=User.Role.REGIONAL,
            status=User.Status.ACTIVE,
            region="2021",
        )

    def test_active_user_can_log_in_without_an_authenticated_request(self):
        response = self.client.post(
            reverse("login"),
            {"email": self.user.email, "password": self.password},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["id"], self.user.id)
        self.assertEqual(response.data["user"]["unreadChatCount"], 0)

    def test_invalid_credentials_return_400(self):
        response = self.client.post(
            reverse("login"),
            {"email": self.user.email, "password": "wrong-password"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
