from accounts.tests.test_institution_subunits import InstitutionSubunitTests
from rest_framework.test import APITestCase
from accounts.models import User
from accounts.serializers import ProfileUpdateSerializer
from django.urls import reverse


class SubdivisionTests(APITestCase):
    setUp = InstitutionSubunitTests.setUp
    register = InstitutionSubunitTests.register

    def test_registration_requires_unit_and_name(self):
        response = self.register("subdivision", outpost_name="Биринчи бөлүмчө")
        self.assertEqual(response.status_code, 400)
        self.assertIn("region", response.data)
        response = self.register("subdivision", region="2026", outpost_name="  ")
        self.assertEqual(response.status_code, 400)
        self.assertIn("outpost_name", response.data)

    def test_registration_and_dashboard(self):
        response = self.register("subdivision", region="2026", outpost_name=" Биринчи бөлүмчө ")
        self.assertEqual(response.status_code, 201, response.data)
        user = User.objects.get(email="subdivision@example.com")
        self.assertEqual((user.role, user.unit_type, user.region, user.outpost_name),
                         ("outpost", "subdivision", "2026", "Биринчи бөлүмчө"))
        self.assertEqual(user.get_unit_type_display(), "Бөлүмчө")
        user.status = "active"
        user.save()
        self.client.force_authenticate(user)
        response = self.client.get(reverse("dashboard-outpost"))
        self.assertEqual(response.status_code, 200, response.data)
        serializer = ProfileUpdateSerializer(user, data={"outpost_name": " "}, partial=True)
        self.assertFalse(serializer.is_valid())
        self.assertIn("outpost_name", serializer.errors)
