import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import User
from accounts.tests.test_admin_users import PNG_BYTES
from submissions.models import ThematicAccountSubmission


class InstitutionSubunitTests(APITestCase):
    def setUp(self):
        self.media = tempfile.TemporaryDirectory()
        self.addCleanup(self.media.cleanup)
        override = override_settings(MEDIA_ROOT=self.media.name)
        override.enable()
        self.addCleanup(override.disable)

    def register(self, unit_type, **extra):
        return self.client.post(reverse("register"), {
            "email": f"{unit_type}@example.com", "password": "test-password",
            "full_name": "Тест", "military_rank": "капитан", "position": "башчы",
            "phone": "+996123456789", "unit_type": unit_type,
            "photo_face": SimpleUploadedFile("face.png", PNG_BYTES, content_type="image/png"),
            **extra,
        }, format="multipart")

    def test_cynology_registration_assigns_name_and_outpost_dashboard_role(self):
        response = self.register("cynology", region="2026", outpost_name="wrong")
        self.assertEqual(response.status_code, 201, response.data)
        user = User.objects.get(email="cynology@example.com")
        self.assertEqual((user.role, user.region, user.outpost_name),
                         ("outpost", "КЖжАККДБ", "Кинология кызматы"))

    def test_course_requires_name_and_assigns_parent_automatically(self):
        response = self.register("course_head")
        self.assertEqual(response.status_code, 400)
        self.assertIn("outpost_name", response.data)
        response = self.register("course_head", outpost_name="Биринчи курс")
        self.assertEqual(response.status_code, 201, response.data)
        user = User.objects.get(email="course_head@example.com")
        self.assertEqual((user.role, user.region, user.outpost_name),
                         ("outpost", "КЖжАККДБ", "Биринчи курс"))

    def make_user(self, unit_type, role, region):
        return User.objects.create_user(username=unit_type, email=f"{unit_type}@example.com",
            unit_type=unit_type, role=role, region=region, status="active",
            outpost_name="Кинология кызматы" if unit_type == "cynology" else "Биринчи курс")

    def test_documents_and_revisions_reach_institution_only(self):
        institution = self.make_user("institution", "regional", "2032")
        other = self.make_user("regional_department", "regional", "КЖжАККДБ")
        for kind in ("cynology", "course_head"):
            sender = self.make_user(kind, "outpost", "КЖжАККДБ")
            self.client.force_authenticate(sender)
            response = self.client.post(reverse("thematic-account-submission-list"), {
                "documentTitle": "Журнал", "sectionId": "combat-training-personnel-journal",
                "periodId": kind, "table": {"columns": [], "rows": []},
            }, format="json")
            self.assertIn(response.status_code, (200, 201), response.data)
            submission = ThematicAccountSubmission.objects.get(sender=sender)
            self.client.force_authenticate(institution)
            response = self.client.get(reverse("thematic-account-submission-list"))
            self.assertIn(submission.pk, [item["id"] for item in response.data])
            detail = reverse("thematic-account-submission-detail", kwargs={"pk": submission.pk})
            self.assertEqual(self.client.patch(detail, {}, format="json").status_code, 200)
            revision = submission.revisions.first()
            revision_url = reverse("combat-training-journal-revision-detail", kwargs={"pk": revision.pk})
            self.assertEqual(self.client.patch(revision_url, {}, format="json").status_code, 200)
            forward_url = reverse("thematic-account-submission-forward", kwargs={"pk": submission.pk})
            self.assertEqual(self.client.post(forward_url, {"documentTitle": "Жөнөтүү"}, format="json").status_code, 201)
            self.client.force_authenticate(other)
            self.assertEqual(self.client.patch(revision_url, {}, format="json").status_code, 403)
            self.assertEqual(self.client.post(forward_url, {"documentTitle": "Жөнөтүү"}, format="json").status_code, 403)
            response = self.client.get(reverse("thematic-account-submission-list"))
            self.assertNotIn(submission.pk, [item["id"] for item in response.data])
            self.assertEqual(self.client.patch(detail, {}, format="json").status_code, 403)

    def test_profile_update_keeps_cynology_fixed_name(self):
        user = self.make_user("cynology", "outpost", "КЖжАККДБ")
        self.client.force_authenticate(user)
        from accounts.serializers import ProfileUpdateSerializer
        serializer = ProfileUpdateSerializer(user, data={"region": "2026", "outpost_name": "wrong"}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()
        self.assertEqual((user.region, user.outpost_name), ("КЖжАККДБ", "Кинология кызматы"))
