from django.urls import reverse
from rest_framework.test import APITestCase

from journals.models import CombatTrainingJournalSubject
from accounts.models import User


class CombatTrainingJournalSubjectApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username="journal-subject-admin@example.com",
            email="journal-subject-admin@example.com",
            password="test-password",
        )
        self.limited_admin = User.objects.create_user(
            username="limited-journal-admin@example.com",
            email="limited-journal-admin@example.com",
            password="test-password",
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        self.outpost = User.objects.create_user(
            username="journal-subject-outpost@example.com",
            email="journal-subject-outpost@example.com",
            password="test-password",
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
            region="2021",
        )
        self.other_outpost = User.objects.create_user(
            username="journal-subject-other@example.com",
            email="journal-subject-other@example.com",
            password="test-password",
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
            region="2022",
        )
        self.url = reverse("combat-training-journal-subject-list")

    def test_user_lists_only_subjects_assigned_to_own_unit(self):
        CombatTrainingJournalSubject.objects.create(
            title="2021 даярдыгы",
            unit_number="2021",
            order=1,
        )
        CombatTrainingJournalSubject.objects.create(
            title="2022 даярдыгы",
            unit_number="2022",
            order=1,
        )
        self.client.force_authenticate(self.outpost)
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["title"], "2021 даярдыгы")
        self.assertEqual(response.data[0]["unitNumber"], "2021")

    def test_only_admin_can_add_subject(self):
        self.client.force_authenticate(self.outpost)
        forbidden = self.client.post(
            self.url,
            {"title": "Жаңы даярдык", "unitNumber": "2021"},
            format="json",
        )
        self.assertEqual(forbidden.status_code, 403)

        self.client.force_authenticate(self.limited_admin)
        limited_admin_forbidden = self.client.post(
            self.url,
            {"title": "Limited admin subject", "unitNumber": "2021"},
            format="json",
        )
        self.assertEqual(limited_admin_forbidden.status_code, 403)

        self.client.force_authenticate(self.admin)
        created = self.client.post(
            self.url,
            {"title": "Жаңы даярдык", "unitNumber": "2021", "order": 1},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertTrue(
            CombatTrainingJournalSubject.objects.filter(
                title="Жаңы даярдык",
                unit_number="2021",
            ).exists()
        )

    def test_admin_can_update_and_delete_unit_subject(self):
        subject = CombatTrainingJournalSubject.objects.create(
            title="Эски аталыш",
            unit_number="2021",
        )
        detail_url = reverse(
            "combat-training-journal-subject-detail",
            kwargs={"pk": subject.id},
        )
        self.client.force_authenticate(self.admin)

        updated = self.client.patch(
            detail_url,
            {"title": "Жаңы аталыш"},
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["title"], "Жаңы аталыш")
        self.assertEqual(self.client.delete(detail_url).status_code, 204)
        subject.refresh_from_db()
        self.assertFalse(subject.is_active)
        self.assertIsNotNone(subject.deleted_at)
