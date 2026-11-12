import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from content.models import ModuleBanner
from accounts.models import User


class ModuleBannerApiTests(APITestCase):
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
        self.admin = User.objects.create_user(
            username="banner-admin@example.com",
            email="banner-admin@example.com",
            password="test-password",
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        self.user = User.objects.create_user(
            username="banner-user@example.com",
            email="banner-user@example.com",
            password="test-password",
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
        )
        self.url = reverse("module-banner-list")

    @staticmethod
    def image(name="banner.png"):
        return SimpleUploadedFile(name, b"image-bytes", content_type="image/png")

    @staticmethod
    def video(name="banner.mp4"):
        return SimpleUploadedFile(name, b"video-bytes", content_type="video/mp4")

    def test_admin_publishes_image_and_user_lists_it(self):
        self.client.force_authenticate(self.admin)
        created = self.client.post(
            self.url,
            {
                "moduleKey": "home",
                "title": "Жаңы баннер",
                "description": "Кошумча маалымат",
                "file": self.image(),
            },
            format="multipart",
        )

        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["kind"], "image")
        self.assertEqual(created.data["description"], "Кошумча маалымат")

        self.client.force_authenticate(self.user)
        listed = self.client.get(self.url, {"moduleKey": "home"})
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(len(listed.data), 1)
        self.assertEqual(listed.data[0]["title"], "Жаңы баннер")

    def test_video_is_supported_on_home_screen(self):
        self.client.force_authenticate(self.admin)
        created = self.client.post(
            self.url,
            {
                "moduleKey": "home",
                "title": "Видео баннер",
                "file": self.video(),
            },
            format="multipart",
        )

        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["kind"], "video")

    def test_regular_user_cannot_publish_or_delete_banner(self):
        item = ModuleBanner.objects.create(
            module_key="meetings",
            title="Баннер",
            file=self.image(),
            uploaded_by=self.admin,
        )
        self.client.force_authenticate(self.user)

        publish_response = self.client.post(
            self.url,
            {"moduleKey": "home", "title": "Жаңы", "file": self.image("new.png")},
            format="multipart",
        )
        delete_response = self.client.delete(reverse("module-banner-detail", args=[item.id]))

        self.assertEqual(publish_response.status_code, 403)
        self.assertEqual(delete_response.status_code, 403)
        self.assertTrue(ModuleBanner.objects.filter(pk=item.id).exists())

    def test_admin_deletes_banner(self):
        item = ModuleBanner.objects.create(
            module_key="combatTrainingResults",
            title="Эски баннер",
            file=self.image(),
            uploaded_by=self.admin,
        )
        self.client.force_authenticate(self.admin)

        response = self.client.delete(reverse("module-banner-detail", args=[item.id]))

        self.assertEqual(response.status_code, 204)
        self.assertFalse(ModuleBanner.objects.filter(pk=item.id).exists())

    def test_section_accepts_no_more_than_three_banners(self):
        self.client.force_authenticate(self.admin)
        for index in range(3):
            response = self.client.post(
                self.url,
                {
                    "moduleKey": "home",
                    "title": f"Баннер {index + 1}",
                    "file": self.image(f"banner-{index + 1}.png"),
                },
                format="multipart",
            )
            self.assertEqual(response.status_code, 201, response.data)

        fourth = self.client.post(
            self.url,
            {
                "moduleKey": "home",
                "title": "Төртүнчү баннер",
                "file": self.image("banner-4.png"),
            },
            format="multipart",
        )

        self.assertEqual(fourth.status_code, 400)
        self.assertEqual(ModuleBanner.objects.filter(module_key="home").count(), 3)

    def test_admin_uploads_multiple_files_and_later_adds_another(self):
        self.client.force_authenticate(self.admin)
        created = self.client.post(
            self.url,
            {
                "moduleKey": "home",
                "title": "Бир нече сүрөт",
                "description": "Биринчи текст",
                "files": [self.image("first.png"), self.image("second.png")],
            },
            format="multipart",
        )

        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(len(created.data["media"]), 2)

        updated = self.client.patch(
            reverse("module-banner-detail", args=[created.data["id"]]),
            {
                "title": "Өзгөртүлгөн аталыш",
                "description": "Жаңы текст",
                "files": [self.video("third.mp4")],
            },
            format="multipart",
        )

        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(updated.data["title"], "Өзгөртүлгөн аталыш")
        self.assertEqual(updated.data["description"], "Жаңы текст")
        self.assertEqual(len(updated.data["media"]), 3)
        self.assertEqual(updated.data["media"][2]["kind"], "video")

    def test_banner_is_rejected_outside_home_screen(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            self.url,
            {
                "moduleKey": "library",
                "title": "Эски бөлүмдүн баннери",
                "file": self.image(),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
