import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from news.models import CombatTrainingNews
from news.models import CombatTrainingNewsRead
from accounts.models import User


class CombatTrainingNewsApiTests(APITestCase):
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
            username="news-admin@example.com",
            email="news-admin@example.com",
            password="test-password",
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        self.user = User.objects.create_user(
            username="news-user@example.com",
            email="news-user@example.com",
            password="test-password",
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
        )
        self.regional = User.objects.create_user(
            username="news-regional@example.com",
            email="news-regional@example.com",
            password="test-password",
            role=User.Role.REGIONAL,
            status=User.Status.ACTIVE,
            region="2026",
        )
        self.list_url = reverse("combat-training-news-list")

    def create_news(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            self.list_url,
            {
                "title": "Жаңы маалымат",
                "body": "Күжүрмөн даярдоо боюнча маалымат",
                "files": SimpleUploadedFile("report.txt", b"report body", content_type="text/plain"),
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)
        return response.data

    def test_admin_publishes_and_user_reads_and_likes_news(self):
        created_news = self.create_news()
        self.assertEqual(len(created_news["attachments"]), 1)
        self.assertEqual(created_news["authorName"], "Администратор")

        self.client.force_authenticate(self.user)
        unread_response = self.client.get(reverse("combat-training-news-unread-count"))
        self.assertEqual(unread_response.status_code, 200)
        self.assertEqual(unread_response.data["unreadCount"], 1)

        list_response = self.client.get(self.list_url)
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.data["results"][0]["likeCount"], 0)

        like_url = reverse("combat-training-news-like", kwargs={"pk": created_news["id"]})
        like_response = self.client.post(like_url)
        self.assertEqual(like_response.data, {"isLiked": True, "likeCount": 1})

        unlike_response = self.client.post(like_url)
        self.assertEqual(unlike_response.data, {"isLiked": False, "likeCount": 0})

        read_response = self.client.post(reverse("combat-training-news-read-all"))
        self.assertEqual(read_response.data["unreadCount"], 0)
        unread_response = self.client.get(reverse("combat-training-news-unread-count"))
        self.assertEqual(unread_response.data["unreadCount"], 0)

    def test_user_can_choose_each_reaction_once_without_affecting_other_reactions(self):
        news = self.create_news()
        url = reverse("combat-training-news-reaction", kwargs={"pk": news["id"]})
        self.client.force_authenticate(self.user)

        liked = self.client.post(url, {"reaction": "like"}, format="json")
        self.assertEqual(liked.status_code, 200)
        self.assertEqual(liked.data["reactionCounts"]["like"], 1)

        loved = self.client.post(url, {"reaction": "love"}, format="json")
        self.assertEqual(loved.data["reactionCounts"]["love"], 1)
        self.assertCountEqual(loved.data["userReactions"], ["like", "love"])

        self.client.force_authenticate(self.regional)
        another_love = self.client.post(url, {"reaction": "love"}, format="json")
        self.assertEqual(another_love.data["reactionCounts"]["love"], 2)
        self.assertEqual(another_love.data["userReactions"], ["love"])

        self.client.force_authenticate(self.user)
        removed_love = self.client.post(url, {"reaction": "love"}, format="json")
        self.assertEqual(removed_love.data["reactionCounts"]["love"], 1)
        self.assertEqual(removed_love.data["reactionCounts"]["like"], 1)
        self.assertEqual(removed_love.data["userReactions"], ["like"])

        listed = self.client.get(self.list_url).data["results"][0]
        self.assertEqual(listed["reactionCounts"]["love"], 1)
        self.assertEqual(listed["userReactions"], ["like"])
        self.assertEqual(self.client.post(url, {"reaction": "invalid"}, format="json").status_code, 400)

    def test_admin_can_upload_video_attachment(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            self.list_url,
            {
                "title": "Видео маалымат",
                "body": "",
                "files": SimpleUploadedFile("training.mp4", b"test-video", content_type="video/mp4"),
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["attachments"][0]["kind"], "video")
        self.assertTrue(response.data["attachments"][0]["fileUrl"].endswith("training.mp4"))

    def test_outpost_cannot_create_edit_or_delete_news(self):
        self.client.force_authenticate(self.user)
        forbidden_response = self.client.post(
            self.list_url,
            {"title": "Нельзя", "body": "Текст"},
        )
        self.assertEqual(forbidden_response.status_code, 403)

        created_news = self.create_news()
        detail_url = reverse("combat-training-news-detail", kwargs={"pk": created_news["id"]})
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.patch(
            detail_url,
            {"title": "Изменённая публикация", "body": "Новый текст"},
            format="multipart",
        ).status_code, 403)
        self.assertEqual(self.client.delete(detail_url).status_code, 403)

    def test_regional_can_publish_and_manage_only_own_news(self):
        self.client.force_authenticate(self.regional)
        response = self.client.post(
            self.list_url,
            {"title": "Бөлүктүн маалыматы", "body": "2026 аскер бөлүгүнүн маалыматы"},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["authorId"], self.regional.id)
        self.assertEqual(response.data["authorName"], "Аскер бөлүгү 2026")

        detail_url = reverse("combat-training-news-detail", kwargs={"pk": response.data["id"]})
        update_response = self.client.patch(
            detail_url,
            {"title": "Өзгөртүлгөн маалымат", "body": "Жаңы текст"},
            format="multipart",
        )
        self.assertEqual(update_response.status_code, 200)

        admin_news = self.create_news()
        admin_detail_url = reverse("combat-training-news-detail", kwargs={"pk": admin_news["id"]})
        self.client.force_authenticate(self.regional)
        self.assertEqual(
            self.client.patch(admin_detail_url, {"title": "Бөтөн"}, format="multipart").status_code,
            403,
        )
        self.assertEqual(self.client.delete(admin_detail_url).status_code, 403)

        self.assertEqual(self.client.delete(detail_url).status_code, 204)
        self.assertEqual(CombatTrainingNews.objects.count(), 1)

        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.delete(admin_detail_url).status_code, 204)
        self.assertFalse(CombatTrainingNews.objects.exists())

    def test_regional_news_is_visible_only_to_outposts_from_same_unit(self):
        matching_outpost = User.objects.create_user(
            username="news-outpost-2026@example.com",
            email="news-outpost-2026@example.com",
            password="test-password",
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
            region="2026",
        )
        other_outpost = User.objects.create_user(
            username="news-outpost-2027@example.com",
            email="news-outpost-2027@example.com",
            password="test-password",
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
            region="2027",
        )

        self.client.force_authenticate(self.regional)
        regional_news = self.client.post(
            self.list_url,
            {"title": "2026 үчүн маалымат", "body": "2026 үчүн гана"},
            format="multipart",
        )
        admin_news = self.create_news()

        self.client.force_authenticate(matching_outpost)
        matching_response = self.client.get(self.list_url)
        self.assertEqual(
            {item["id"] for item in matching_response.data["results"]},
            {regional_news.data["id"], admin_news["id"]},
        )
        self.assertEqual(
            self.client.get(reverse("combat-training-news-unread-count")).data["unreadCount"],
            2,
        )

        self.client.force_authenticate(other_outpost)
        other_response = self.client.get(self.list_url)
        self.assertEqual(
            [item["id"] for item in other_response.data["results"]],
            [admin_news["id"]],
        )
        self.assertEqual(
            self.client.get(reverse("combat-training-news-unread-count")).data["unreadCount"],
            1,
        )
        hidden_like_url = reverse(
            "combat-training-news-like",
            kwargs={"pk": regional_news.data["id"]},
        )
        self.assertEqual(self.client.post(hidden_like_url).status_code, 404)

        self.assertEqual(
            self.client.post(reverse("combat-training-news-read-all")).status_code,
            200,
        )
        self.assertFalse(
            CombatTrainingNewsRead.objects.filter(
                news_id=regional_news.data["id"],
                user=other_outpost,
            ).exists()
        )
