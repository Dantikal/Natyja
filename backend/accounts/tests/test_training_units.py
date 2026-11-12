import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import User
from accounts.serializers import AdminUserSerializer, ProfileUpdateSerializer
from accounts.tests.test_admin_users import PNG_BYTES


class TrainingUnitTests(APITestCase):
    def setUp(self):
        media = tempfile.TemporaryDirectory()
        self.addCleanup(media.cleanup)
        override = override_settings(MEDIA_ROOT=media.name)
        override.enable()
        self.addCleanup(override.disable)

    def register(self, kind, email=None, **extra):
        return self.client.post(reverse("register"), {
            "email": email or f"{kind}@example.com", "password": "test-password",
            "full_name": "Тест", "military_rank": "капитан", "position": "башчы",
            "phone": "+996123456789", "unit_type": kind,
            "photo_face": SimpleUploadedFile("face.png", PNG_BYTES, content_type="image/png"),
            **extra,
        }, format="multipart")

    def center(self, **extra):
        return User.objects.create_user(username=extra.pop("username", "center"),
            email=extra.pop("email", "center@example.com"), role="outpost",
            unit_type="training_center_head", region="2026", outpost_name="Кемин окуу борбору",
            status=extra.pop("status", "pending"), **extra)

    def test_center_registration_requires_unit_and_name(self):
        response = self.register("training_center_head")
        self.assertEqual(response.status_code, 400)
        self.assertIn("region", response.data)
        self.assertIn("outpost_name", response.data)
        response = self.register("training_center_head", region="2026", outpost_name="Кемин окуу борбору")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["user"]["role"], "outpost")
        self.assertEqual(response.data["user"]["outpost_name"], "Кемин окуу борбору")
        directory = self.client.get(reverse("training-centers"))
        self.assertEqual(directory.data, [{"id": response.data["user"]["id"], "name": "Кемин окуу борбору", "region": "2026"}])

    def test_platoon_inherits_center_unit_and_saves_digits(self):
        center = self.center()
        response = self.register("training_platoon_commander", training_center=center.pk,
                                 platoon_number="03", region="2032", outpost_name="wrong")
        self.assertEqual(response.status_code, 201, response.data)
        user = response.data["user"]
        self.assertEqual(user["training_center"], center.pk)
        self.assertEqual(user["training_center_name"], center.outpost_name)
        self.assertEqual((user["region"], user["platoon_number"], user["role"]), ("2026", "03", "outpost"))
        self.assertEqual(user["outpost_name"], "№ 03 окуу взводу")

    def test_platoon_requires_real_center_and_numeric_number(self):
        response = self.register("training_platoon_commander")
        self.assertEqual(response.status_code, 400)
        self.assertIn("training_center", response.data)
        self.assertIn("platoon_number", response.data)
        center = self.center()
        for number in ["№", "-2", "2.5", "abc"]:
            response = self.register("training_platoon_commander", training_center=center.pk, platoon_number=number)
            self.assertEqual(response.status_code, 400)
            self.assertIn("platoon_number", response.data)
        center.unit_type = "outpost"
        center.save()
        response = self.register("training_platoon_commander", training_center=center.pk, platoon_number="1")
        self.assertEqual(response.status_code, 400)
        self.assertIn("training_center", response.data)

    def test_directory_excludes_rejected_and_does_not_expose_personal_data(self):
        self.center(status="rejected")
        self.assertEqual(self.client.get(reverse("training-centers")).data, [])
        center = self.center(username="active", email="active@example.com", status="active")
        self.assertEqual(self.client.get(reverse("training-centers")).data,
                         [{"id": center.pk, "name": center.outpost_name, "region": center.region}])
        response = self.register("training_platoon_commander", training_center=User.objects.get(username="center").pk, platoon_number="1")
        self.assertEqual(response.status_code, 400)

    def test_profile_and_admin_updates_preserve_and_validate_relation(self):
        center = self.center()
        user = User.objects.create_user(username="platoon", email="platoon@example.com", role="outpost",
            unit_type="training_platoon_commander", training_center=center, platoon_number="2", region=center.region)
        for serializer_class in [ProfileUpdateSerializer, AdminUserSerializer]:
            serializer = serializer_class(user, data={"platoon_number": "4", "region": "2032"}, partial=True)
            self.assertTrue(serializer.is_valid(), serializer.errors)
            user = serializer.save()
            self.assertEqual((user.region, user.outpost_name), (center.region, "№ 4 окуу взводу"))
            serializer = serializer_class(user, data={"training_center": None}, partial=True)
            self.assertFalse(serializer.is_valid())
            self.assertIn("training_center", serializer.errors)

    def test_both_types_can_load_outpost_dashboard(self):
        center = self.center(status="active")
        platoon = User.objects.create_user(username="platoon", email="platoon@example.com", role="outpost",
            status="active", unit_type="training_platoon_commander", training_center=center,
            platoon_number="2", region=center.region, outpost_name="№ 2 окуу взводу")
        for user in [center, platoon]:
            self.client.force_authenticate(user)
            response = self.client.get(reverse("dashboard-outpost"))
            self.assertEqual(response.status_code, 200, response.data)
