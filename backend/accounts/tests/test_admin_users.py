import base64
import shutil
import tempfile
from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from submissions.models import SubmissionEditRequest
from submissions.models import ThematicAccountSubmission
from accounts.models import User


PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


class AdminUsersApiTests(APITestCase):
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
            username="users-admin@example.com",
            email="users-admin@example.com",
            password="test-password",
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        self.client.force_authenticate(self.admin)

    def test_regional_user_list_is_scoped_to_own_unit_and_includes_presence(self):
        regional = User.objects.create_user(
            username="regional-users-2026@example.com",
            email="regional-users-2026@example.com",
            password="test-password",
            role=User.Role.REGIONAL,
            status=User.Status.ACTIVE,
            region="2026",
        )
        matching_user = User.objects.create_user(
            username="outpost-users-2026@example.com",
            email="outpost-users-2026@example.com",
            password="test-password",
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
            region="2026",
            outpost_name="2026 заставасы",
            last_login=timezone.now(),
        )
        other_user = User.objects.create_user(
            username="outpost-users-2027@example.com",
            email="outpost-users-2027@example.com",
            password="test-password",
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
            region="2027",
        )
        self.client.force_authenticate(regional)

        response = self.client.get(reverse("scoped-users"))

        self.assertEqual(response.status_code, 200)
        returned_ids = {item["id"] for item in response.data}
        self.assertIn(regional.id, returned_ids)
        self.assertIn(matching_user.id, returned_ids)
        self.assertNotIn(other_user.id, returned_ids)
        matching_data = next(item for item in response.data if item["id"] == matching_user.id)
        self.assertTrue(matching_data["isOnline"])
        self.assertIsNotNone(matching_data["lastSeen"])

    def test_admin_creates_user_with_registration_fields_and_face_photo(self):
        response = self.client.post(
            reverse("admin-users"),
            {
                "email": "new-outpost@example.com",
                "password": "test-password",
                "full_name": "Новый пользователь",
                "military_rank": "капитан",
                "position": "начальник",
                "unit_type": User.UnitType.OUTPOST,
                "phone": "+996123456789",
                "region": "2021",
                "outpost_name": "Ак-Чечек чек ара заставасы",
                "role": User.Role.OUTPOST,
                "status": User.Status.ACTIVE,
                "photo_face": SimpleUploadedFile("face.png", PNG_BYTES, content_type="image/png"),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["outpost_name"], "Ак-Чечек чек ара заставасы")
        self.assertTrue(response.data["photo_face"])
        self.assertNotIn("photo_military_id", response.data)

    def test_admin_quickly_creates_active_user_who_completes_profile(self):
        created = self.client.post(
            reverse("admin-user-quick-create"),
            {
                "region": "2021",
                "outpost_name": "Ак-Чечек чек ара заставасы",
                "email": "quick-user@example.com",
                "password": "test-password",
            },
            format="json",
        )

        self.assertEqual(created.status_code, 201, created.data)
        quick_user = User.objects.get(email="quick-user@example.com")
        self.assertEqual(quick_user.status, User.Status.ACTIVE)
        self.assertEqual(quick_user.role, User.Role.OUTPOST)
        self.assertFalse(quick_user.profile_completed)

        self.client.force_authenticate(quick_user)
        completed = self.client.patch(
            reverse("me"),
            {
                "email": "changed-quick-user@example.com",
                "full_name": "Толук аты-жөнү",
                "military_rank": "капитан",
                "position": "застава башчысы",
                "unit_type": User.UnitType.OUTPOST,
                "phone": "+996123456789",
                "region": "2021",
                "outpost_name": "Ак-Чечек чек ара заставасы",
                "photo_face": SimpleUploadedFile("quick-face.png", PNG_BYTES, content_type="image/png"),
                "complete_profile": "true",
            },
            format="multipart",
        )

        self.assertEqual(completed.status_code, 200, completed.data)
        self.assertTrue(completed.data["profile_completed"])
        quick_user.refresh_from_db()
        self.assertEqual(quick_user.username, "changed-quick-user@example.com")
        self.assertEqual(quick_user.full_name, "Толук аты-жөнү")

    def test_user_can_edit_own_profile_fields_and_password(self):
        profile_user = User.objects.create_user(
            username="profile-user@example.com",
            email="profile-user@example.com",
            password="old-password",
            full_name="Old Name",
            unit_type=User.UnitType.OUTPOST,
            region="2021",
            outpost_name="Ак-Чечек чек ара заставасы",
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
        )
        self.client.force_authenticate(profile_user)

        response = self.client.patch(
            reverse("me"),
            {
                "email": "edited-profile@example.com",
                "password": "new-password",
                "full_name": "New Name",
                "military_rank": "майор",
                "position": "начальник",
                "unit_type": User.UnitType.OUTPOST,
                "phone": "+996987654321",
                "region": "2022",
                "outpost_name": "Чон-Кара чек ара заставасы",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        profile_user.refresh_from_db()
        self.assertEqual(profile_user.email, "edited-profile@example.com")
        self.assertEqual(profile_user.username, "edited-profile@example.com")
        self.assertEqual(profile_user.region, "2022")
        self.assertTrue(profile_user.check_password("new-password"))

    def test_admin_user_list_contains_presence_status(self):
        online_user = User.objects.create_user(
            username="online-user@example.com",
            email="online-user@example.com",
            password="test-password",
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
            last_login=timezone.now(),
        )
        offline_user = User.objects.create_user(
            username="offline-user@example.com",
            email="offline-user@example.com",
            password="test-password",
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
            last_login=timezone.now() - timedelta(minutes=5),
        )

        response = self.client.get(reverse("admin-users"))

        self.assertEqual(response.status_code, 200)
        users = {item["id"]: item for item in response.data}
        self.assertTrue(users[online_user.id]["isOnline"])
        self.assertFalse(users[offline_user.id]["isOnline"])
        self.assertIsNotNone(users[offline_user.id]["lastSeen"])

    def test_dashboard_admin_account_is_not_a_superuser(self):
        response = self.client.post(
            reverse("admin-users"),
            {
                "email": "limited-admin@example.com",
                "password": "test-password",
                "full_name": "Limited admin",
                "military_rank": "major",
                "position": "administrator",
                "unit_type": "",
                "phone": "+996123456789",
                "region": "",
                "outpost_name": "",
                "role": User.Role.ADMIN,
                "status": User.Status.ACTIVE,
                "photo_face": SimpleUploadedFile("admin.png", PNG_BYTES, content_type="image/png"),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201, response.data)
        created = User.objects.get(email="limited-admin@example.com")
        self.assertEqual(created.role, User.Role.ADMIN)
        self.assertTrue(created.is_staff)
        self.assertFalse(created.is_superuser)
        self.assertFalse(response.data["is_superuser"])

    def test_limited_admin_can_view_requests_but_cannot_moderate_them(self):
        pending_user = User.objects.create_user(
            username="pending@example.com",
            email="pending@example.com",
            password="test-password",
            role=User.Role.OUTPOST,
            status=User.Status.PENDING,
        )

        list_response = self.client.get(reverse("pending-requests"))
        moderate_response = self.client.post(
            reverse("moderate-request", args=[pending_user.id]),
            {"decision": "approve"},
            format="json",
        )

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(moderate_response.status_code, 403)
        pending_user.refresh_from_db()
        self.assertEqual(pending_user.status, User.Status.PENDING)

    def test_limited_admin_cannot_change_or_delete_primary_admin(self):
        primary_admin = User.objects.create_superuser(
            username="primary@example.com",
            email="primary@example.com",
            password="test-password",
        )
        detail_url = reverse("admin-user-detail", args=[primary_admin.id])

        update_response = self.client.patch(
            detail_url,
            {"full_name": "Changed name"},
            format="json",
        )
        delete_response = self.client.delete(detail_url)

        self.assertEqual(update_response.status_code, 403)
        self.assertEqual(delete_response.status_code, 403)
        self.assertTrue(User.objects.filter(pk=primary_admin.id).exists())

    def test_registration_stores_full_outpost_name(self):
        response = self.client.post(
            reverse("register"),
            {
                "email": "registered-outpost@example.com",
                "password": "test-password",
                "full_name": "Новый пользователь",
                "military_rank": "капитан",
                "position": "начальник",
                "unit_type": User.UnitType.OUTPOST,
                "phone": "+996123456789",
                "region": "2032",
                "outpost_name": "Достук",
                "photo_face": SimpleUploadedFile("face.png", PNG_BYTES, content_type="image/png"),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(
            response.data["user"]["outpost_name"],
            "Достук чек ара заставасы",
        )

    def test_registration_accepts_named_subunits(self):
        for unit_type, unit_name in (
            (User.UnitType.CHECKPOINT, "Ак-Жол КӨП"),
            (User.UnitType.DETACHMENT, "Баткен отряды"),
            (User.UnitType.GROUP, "Ыкчам топ"),
            (User.UnitType.COMPANY, "Биринчи рота"),
            (User.UnitType.PLATOON, "Экинчи взвод"),
        ):
            with self.subTest(unit_type=unit_type):
                response = self.client.post(
                    reverse("register"),
                    {
                        "email": f"{unit_type}@example.com",
                        "password": "test-password",
                        "full_name": "Жаңы колдонуучу",
                        "military_rank": "капитан",
                        "position": "башчы",
                        "unit_type": unit_type,
                        "phone": "+996123456789",
                        "region": "2032",
                        "outpost_name": unit_name,
                        "photo_face": SimpleUploadedFile(
                            "face.png", PNG_BYTES, content_type="image/png"
                        ),
                    },
                    format="multipart",
                )

                self.assertEqual(response.status_code, 201, response.data)
                self.assertEqual(response.data["user"]["unit_type"], unit_type)
                self.assertEqual(response.data["user"]["region"], "2032")
                self.assertEqual(response.data["user"]["outpost_name"], unit_name)
                self.assertEqual(response.data["user"]["role"], User.Role.OUTPOST)

    def test_checkpoint_registration_requires_name(self):
        response = self.client.post(
            reverse("register"),
            {
                "email": "checkpoint-without-name@example.com",
                "password": "test-password",
                "full_name": "КӨП колдонуучусу",
                "military_rank": "капитан",
                "position": "башчы",
                "unit_type": User.UnitType.CHECKPOINT,
                "phone": "+996123456789",
                "region": "2032",
                "photo_face": SimpleUploadedFile("face.png", PNG_BYTES, content_type="image/png"),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("outpost_name", response.data)

    def test_registration_accepts_institution_with_only_military_unit_number(self):
        response = self.client.post(
            reverse("register"),
            {
                "email": "institution@example.com",
                "password": "test-password",
                "full_name": "Мекеме колдонуучусу",
                "military_rank": "капитан",
                "position": "башчы",
                "unit_type": User.UnitType.INSTITUTION,
                "phone": "+996123456789",
                "region": "2032",
                "photo_face": SimpleUploadedFile(
                    "face.png", PNG_BYTES, content_type="image/png"
                ),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["user"]["unit_type"], User.UnitType.INSTITUTION)
        self.assertEqual(response.data["user"]["region"], "2032")
        self.assertEqual(response.data["user"]["outpost_name"], "")
        self.assertEqual(response.data["user"]["role"], User.Role.REGIONAL)

    def test_admin_deletes_user_with_related_submission_records(self):
        user = User.objects.create_user(
            username="deleted-user@example.com",
            email="deleted-user@example.com",
            password="test-password",
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
            region="2032",
            outpost_name="Достук",
        )
        submission = ThematicAccountSubmission.objects.create(
            sender=user,
            unit_number=user.region,
            outpost_name=user.outpost_name,
            document_title="Тематический отчёт",
            table_data={},
        )
        edit_request = SubmissionEditRequest.objects.create(
            submission=submission,
            requester=user,
        )

        response = self.client.delete(reverse("admin-user-detail", args=[user.id]))

        self.assertEqual(response.status_code, 204)
        self.assertFalse(User.objects.filter(pk=user.id).exists())
        self.assertFalse(ThematicAccountSubmission.objects.filter(pk=submission.id).exists())
        self.assertFalse(SubmissionEditRequest.objects.filter(pk=edit_request.id).exists())
