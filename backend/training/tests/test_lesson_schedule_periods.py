from django.urls import reverse
from rest_framework.test import APITestCase

from training.services import build_library_sections_from_db
from training.models import TrainingPeriod
from training.models import TrainingSection
from training.models import TrainingTable
from accounts.models import User


class LessonSchedulePeriodApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="week-owner@example.com",
            email="week-owner@example.com",
            password="test-password",
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
            region="2021",
        )
        self.other_user = User.objects.create_user(
            username="other-outpost@example.com",
            email="other-outpost@example.com",
            password="test-password",
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
            region="2021",
        )
        self.regional = User.objects.create_user(
            username="regional-2021@example.com",
            email="regional-2021@example.com",
            password="test-password",
            role=User.Role.REGIONAL,
            status=User.Status.ACTIVE,
            region="2021",
        )
        self.section, _ = TrainingSection.objects.get_or_create(
            slug="lesson-schedule",
            defaults={"title": "Сабактардын жүгүртмөсү"},
        )
        base_period, _ = TrainingPeriod.objects.get_or_create(
            section=self.section,
            slug="lesson-schedule-week-1",
            defaults={"title": "1 жумасы", "order": 10},
        )
        TrainingTable.objects.get_or_create(
            period=base_period,
            defaults={
                "title": base_period.title,
                "variant": TrainingTable.Variant.LESSON_SCHEDULE,
                "columns": [],
                "rows": [],
            },
        )
        self.list_url = reverse("lesson-schedule-period-list")

    def test_outpost_can_open_both_command_training_sections(self):
        sections = build_library_sections_from_db(self.owner)
        command_training = next(
            section for section in sections if section["id"] == "command-training"
        )
        command_sections = {
            section["id"]: section for section in command_training["sections"]
        }

        self.assertNotIn("periods", command_sections["command-thematic-account"])
        self.assertTrue(command_sections["command-lesson-schedule"]["periods"])

    def test_outpost_and_regional_can_manage_own_thematic_account_documents(self):
        list_url = reverse("library-period-list")
        for user, section_slug, title in (
            (self.owner, "thematic-account", "Заставанын тематикалык эсеби"),
            (self.regional, "command-thematic-account", "Аскер бөлүгүнүн тематикалык эсеби"),
        ):
            self.client.force_authenticate(user)
            create_response = self.client.post(
                list_url,
                {"section": section_slug, "title": title},
                format="json",
            )
            self.assertEqual(create_response.status_code, 201)
            self.assertTrue(create_response.data["canEdit"])
            self.assertTrue(create_response.data["canDelete"])

            period = TrainingPeriod.objects.get(
                section__slug=section_slug,
                slug=create_response.data["id"],
            )
            self.assertEqual(period.created_by, user)

            detail_url = reverse(
                "library-period-detail",
                kwargs={"section_slug": section_slug, "period_slug": period.slug},
            )
            update_response = self.client.patch(
                detail_url,
                {"title": f"{title} жаңыртылды"},
                format="json",
            )
            self.assertEqual(update_response.status_code, 200)

            self.client.force_authenticate(self.other_user)
            self.assertEqual(
                self.client.patch(detail_url, {"title": "Чоочун"}, format="json").status_code,
                403,
            )

            self.client.force_authenticate(user)
            self.assertEqual(self.client.delete(detail_url).status_code, 204)

    def test_creator_can_delete_added_week_and_other_user_cannot_see_it(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            self.list_url,
            {"section": "lesson-schedule", "title": "2 жумасы", "weekNumber": "2"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["canDelete"])

        other_sections = build_library_sections_from_db(self.other_user)
        lesson_section = next(
            child
            for section in other_sections
            for child in section.get("sections", [])
            if child["id"] == "lesson-schedule"
        )
        self.assertNotIn(response.data["id"], [item["id"] for item in lesson_section["periods"]])

        detail_url = reverse(
            "lesson-schedule-period-detail",
            kwargs={"section_slug": "lesson-schedule", "period_slug": response.data["id"]},
        )
        self.client.force_authenticate(self.other_user)
        self.assertEqual(self.client.delete(detail_url).status_code, 403)

        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.delete(detail_url).status_code, 204)

    def test_outpost_can_delete_legacy_custom_week_but_not_system_week(self):
        legacy_period = TrainingPeriod.objects.create(
            section=self.section,
            slug="lesson-schedule-week-в",
            title="Эски кошулган жума",
            order=90,
        )
        TrainingTable.objects.create(
            period=legacy_period,
            title=legacy_period.title,
            variant=TrainingTable.Variant.LESSON_SCHEDULE,
            columns=[],
            rows=[],
        )
        legacy_url = reverse(
            "lesson-schedule-period-detail",
            kwargs={"section_slug": "lesson-schedule", "period_slug": legacy_period.slug},
        )
        system_url = reverse(
            "lesson-schedule-period-detail",
            kwargs={"section_slug": "lesson-schedule", "period_slug": "lesson-schedule-week-1"},
        )

        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.delete(legacy_url).status_code, 204)
        self.assertEqual(self.client.delete(system_url).status_code, 403)
