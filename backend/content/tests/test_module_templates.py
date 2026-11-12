import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from content.models import ModuleTemplate
from accounts.models import User


class ModuleTemplateApiTests(APITestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.media_root = tempfile.mkdtemp()
        cls.settings_override = override_settings(MEDIA_ROOT=cls.media_root)
        cls.settings_override.enable()

    @classmethod
    def tearDownClass(cls):
        cls.settings_override.disable()
        shutil.rmtree(cls.media_root, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.primary_admin = User.objects.create_superuser(
            username="primary-template-admin@example.com",
            email="primary-template-admin@example.com",
            password="test-password",
        )
        self.limited_admin = User.objects.create_user(
            username="template-admin@example.com",
            email="template-admin@example.com",
            password="test-password",
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        self.user = User.objects.create_user(
            username="template-user@example.com",
            email="template-user@example.com",
            password="test-password",
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
        )
        self.url = reverse("module-template-list")

    def pdf(self, name="sample.pdf"):
        return SimpleUploadedFile(name, b"%PDF-1.4\n%%EOF", content_type="application/pdf")

    def image(self, name="photo.png"):
        return SimpleUploadedFile(name, b"image-bytes", content_type="image/png")

    def test_admin_uploads_pdf_and_active_user_lists_it(self):
        self.client.force_authenticate(self.limited_admin)
        created = self.client.post(
            self.url,
            {"moduleKey": "library", "title": "Sample", "file": self.pdf()},
            format="multipart",
        )

        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["moduleKey"], "library")
        self.assertEqual(created.data["title"], "Sample")
        self.assertEqual(created.data["kind"], "pdf")

        self.client.force_authenticate(self.user)
        listed = self.client.get(self.url, {"moduleKey": "library"})
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(len(listed.data), 1)
        self.assertTrue(listed.data[0]["fileUrl"].endswith(".pdf"))

    def test_admin_uploads_image_with_required_title(self):
        self.client.force_authenticate(self.limited_admin)
        missing_title = self.client.post(
            self.url,
            {"moduleKey": "library", "file": self.image()},
            format="multipart",
        )
        self.assertEqual(missing_title.status_code, 400)

        created = self.client.post(
            self.url,
            {"moduleKey": "library", "title": "Photo example", "file": self.image()},
            format="multipart",
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["kind"], "image")
        self.assertTrue(created.data["fileUrl"].endswith(".png"))

    def test_regular_user_cannot_upload(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            self.url,
            {"moduleKey": "library", "file": self.pdf()},
            format="multipart",
        )
        self.assertEqual(response.status_code, 403)

    def test_non_pdf_is_rejected(self):
        self.client.force_authenticate(self.primary_admin)
        response = self.client.post(
            self.url,
            {
                "moduleKey": "library",
                "file": SimpleUploadedFile("sample.txt", b"text", content_type="text/plain"),
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)

    def test_limited_admin_cannot_change_primary_only_module_templates(self):
        self.client.force_authenticate(self.limited_admin)
        forbidden = self.client.post(
            self.url,
            {"moduleKey": "smr", "file": self.pdf()},
            format="multipart",
        )
        self.assertEqual(forbidden.status_code, 403)

        item = ModuleTemplate.objects.create(
            module_key="smr",
            title="Protected",
            file=self.pdf("protected.pdf"),
            uploaded_by=self.primary_admin,
        )
        delete_response = self.client.delete(reverse("module-template-detail", args=[item.id]))
        self.assertEqual(delete_response.status_code, 403)
        self.assertTrue(ModuleTemplate.objects.filter(pk=item.id).exists())

    def test_primary_admin_can_upload_and_delete_restricted_template(self):
        self.client.force_authenticate(self.primary_admin)
        created = self.client.post(
            self.url,
            {"moduleKey": "combatTrainingJournal", "title": "Journal sample", "file": self.pdf()},
            format="multipart",
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(
            self.client.delete(reverse("module-template-detail", args=[created.data["id"]])).status_code,
            204,
        )
