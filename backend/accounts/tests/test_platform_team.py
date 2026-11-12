import base64
import tempfile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase
from accounts.models import User, PlatformTeamPhoto


class PlatformTeamTests(APITestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.settings = override_settings(MEDIA_ROOT=self.directory.name)
        self.settings.enable()
        self.addCleanup(self.settings.disable)
        self.admin = User.objects.create_user(username="admin", email="admin@example.com", role="admin", status="active")
        self.reader = User.objects.create_user(username="reader", email="reader@example.com", role="outpost", status="active")
        self.url = "/api/auth/platform-team/"

    def photo(self):
        return SimpleUploadedFile("photo.png", base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
        ), content_type="image/png")

    def test_admin_can_upload_and_replace_all_three_photos(self):
        self.client.force_authenticate(self.admin)
        for member in ("shakenov", "akmatov", "saifudinov"):
            for _ in range(2):
                response = self.client.post(self.url, {"member": member, "photo": self.photo()}, format="multipart")
                self.assertEqual(response.status_code, 200, response.data)
                self.assertTrue(response.data["photo"])
        self.assertEqual(PlatformTeamPhoto.objects.count(), 3)
        self.client.force_authenticate(self.reader)
        self.assertEqual(len(self.client.get(self.url).data), 3)

    def test_reader_cannot_upload(self):
        self.client.force_authenticate(self.reader)
        self.assertEqual(self.client.post(self.url, {"member": "shakenov", "photo": self.photo()}, format="multipart").status_code, 403)

    def test_invalid_member_and_non_image_are_rejected(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(self.url, {"member": "unknown", "photo": self.photo()}, format="multipart").status_code, 400)
        self.assertEqual(self.client.post(self.url, {"member": "shakenov", "photo": SimpleUploadedFile("bad.png", b"invalid")}, format="multipart").status_code, 400)
