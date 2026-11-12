from datetime import datetime

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from submissions.models import CombatTrainingJournalRevision
from submissions.models import ThematicAccountSubmission
from training.models import TrainingPeriod
from accounts.models import User
from accounts.outposts import OUTPOSTS_BY_MILITARY_UNIT, format_outpost_name


class ThematicAccountSubmissionApiTests(APITestCase):
    def setUp(self):
        self.outpost = User.objects.create_user(
            username="outpost-2021@example.com",
            email="outpost-2021@example.com",
            password="test-password",
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
            unit_type=User.UnitType.OUTPOST,
            region="2021",
            outpost_name="Жаштык чек ара заставасы",
        )
        self.regional = User.objects.create_user(
            username="unit-2021@example.com",
            email="unit-2021@example.com",
            password="test-password",
            role=User.Role.REGIONAL,
            status=User.Status.ACTIVE,
            unit_type=User.UnitType.REGIONAL,
            region="2021",
        )
        self.other_regional = User.objects.create_user(
            username="unit-2022@example.com",
            email="unit-2022@example.com",
            password="test-password",
            role=User.Role.REGIONAL,
            status=User.Status.ACTIVE,
            unit_type=User.UnitType.REGIONAL,
            region="2022",
        )
        self.url = reverse("thematic-account-submission-list")

    def test_admin_can_filter_submission_list_by_multiple_sections(self):
        admin = User.objects.create_user(
            username="admin-filter@example.com",
            email="admin-filter@example.com",
            password="test-password",
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        ThematicAccountSubmission.objects.create(
            sender=self.regional,
            unit_number="2021",
            document_title="Thematic document",
            section_slug="thematic-account",
        )
        ThematicAccountSubmission.objects.create(
            sender=self.regional,
            unit_number="2021",
            document_title="Memo letter",
            section_slug="memo-letter",
        )
        ThematicAccountSubmission.objects.create(
            sender=self.regional,
            unit_number="2021",
            document_title="Other section",
            section_slug="combat-training-analysis",
        )
        self.client.force_authenticate(admin)

        response = self.client.get(
            self.url,
            {"sectionId": ["thematic-account", "memo-letter"]},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {item["sectionId"] for item in response.data},
            {"thematic-account", "memo-letter"},
        )

    def test_submission_list_sender_filter_is_limited_to_current_user(self):
        self.client.force_authenticate(self.regional)

        response = self.client.get(self.url, {"senderId": self.other_regional.id})

        self.assertEqual(response.status_code, 403)

    def test_regional_user_always_sees_own_submission_for_status(self):
        submission = ThematicAccountSubmission.objects.create(
            sender=self.regional,
            unit_number="legacy-unit-number",
            document_title="My submitted document",
            section_slug="thematic-account",
        )
        self.client.force_authenticate(self.regional)

        response = self.client.get(self.url, {"sectionId": "thematic-account"})

        self.assertEqual(response.status_code, 200)
        self.assertIn(submission.id, {item["id"] for item in response.data})

    def test_regional_user_sees_registered_outposts_from_own_unit(self):
        User.objects.create_user(
            username="outpost-2022@example.com",
            email="outpost-2022@example.com",
            password="test-password",
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
            unit_type=User.UnitType.OUTPOST,
            region="2022",
            outpost_name="Other unit outpost",
        )
        self.client.force_authenticate(self.regional)

        response = self.client.get(reverse("combat-training-journal-outpost-list"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["unitNumber"], "2021")
        self.assertEqual(response.data[0]["name"], self.outpost.outpost_name)

    def test_admin_rating_orders_regional_units_by_submitted_document_count(self):
        ThematicAccountSubmission.objects.bulk_create([
            ThematicAccountSubmission(
                sender=self.regional,
                unit_number="2021",
                document_title="2021 document 1",
                section_slug="thematic-account",
            ),
            ThematicAccountSubmission(
                sender=self.regional,
                unit_number="2021",
                document_title="2021 document 2",
                section_slug="thematic-account",
            ),
            ThematicAccountSubmission(
                sender=self.regional,
                unit_number="2021",
                document_title="2021 document 3",
                section_slug="lesson-schedule",
            ),
            ThematicAccountSubmission(
                sender=self.other_regional,
                unit_number="2022",
                document_title="2022 document 1",
                section_slug="thematic-account",
            ),
            ThematicAccountSubmission(
                sender=self.outpost,
                unit_number="2021",
                outpost_name=self.outpost.outpost_name,
                document_title="2021 outpost document",
                section_slug="lesson-schedule",
            ),
        ])
        admin = User.objects.create_user(
            username="rating-admin@example.com",
            email="rating-admin@example.com",
            password="test-password",
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        self.client.force_authenticate(admin)

        response = self.client.get(reverse("regional-unit-ratings"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item["unitNumber"] for item in response.data["results"][:2]],
            ["2021", "2022"],
        )
        self.assertEqual(response.data["results"][0]["totalDocuments"], 4)
        self.assertEqual(response.data["results"][0]["regionalDocuments"], 3)
        self.assertEqual(response.data["results"][0]["outpostDocuments"], 1)
        self.assertEqual(response.data["results"][1]["totalDocuments"], 1)
        self.assertEqual(response.data["results"][0]["rank"], 1)

    def test_regional_user_can_compare_all_military_units_without_action_history(self):
        ThematicAccountSubmission.objects.bulk_create([
            ThematicAccountSubmission(
                sender=self.regional,
                unit_number="2021",
                document_title="Own unit document",
            ),
            ThematicAccountSubmission(
                sender=self.other_regional,
                unit_number="2022",
                document_title="Other unit document",
            ),
        ])
        self.client.force_authenticate(self.regional)

        response = self.client.get(reverse("regional-unit-ratings"), {"period": "all"})

        self.assertEqual(response.status_code, 200)
        results_by_unit = {
            item["unitNumber"]: item for item in response.data["results"]
        }
        self.assertIn("2021", results_by_unit)
        self.assertIn("2022", results_by_unit)
        self.assertEqual(results_by_unit["2021"]["actions"], [])
        self.assertEqual(results_by_unit["2022"]["actions"], [])

    def test_regional_rating_contains_only_own_outposts_ordered_by_documents(self):
        second_outpost = User.objects.create_user(
            username="rating-outpost-2@example.com",
            email="rating-outpost-2@example.com",
            password="test-password",
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
            region="2021",
            outpost_name="Ак-Суу",
        )
        foreign_outpost = User.objects.create_user(
            username="rating-outpost-foreign@example.com",
            email="rating-outpost-foreign@example.com",
            password="test-password",
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
            region="2022",
            outpost_name="Чарбак",
        )
        ThematicAccountSubmission.objects.bulk_create([
            ThematicAccountSubmission(
                sender=self.outpost,
                unit_number="2021",
                outpost_name=self.outpost.outpost_name,
                document_title="Leader 1",
            ),
            ThematicAccountSubmission(
                sender=self.outpost,
                unit_number="2021",
                outpost_name=self.outpost.outpost_name,
                document_title="Leader 2",
            ),
            ThematicAccountSubmission(
                sender=second_outpost,
                unit_number="2021",
                outpost_name=second_outpost.outpost_name,
                document_title="Second 1",
            ),
            ThematicAccountSubmission(
                sender=foreign_outpost,
                unit_number="2022",
                outpost_name=foreign_outpost.outpost_name,
                document_title="Foreign 1",
            ),
        ])
        self.client.force_authenticate(self.regional)

        response = self.client.get(reverse("outpost-ratings"))

        self.assertEqual(response.status_code, 200)
        results = response.data["results"]
        # The rating includes the unit's directory entries, even without submissions.
        self.assertEqual(
            [item["outpostName"] for item in results[:2]],
            [self.outpost.outpost_name, "Ак-Суу чек ара заставасы"],
        )
        self.assertEqual([item["totalDocuments"] for item in results[:2]], [2, 1])
        expected_names = {
            format_outpost_name(name) for name in OUTPOSTS_BY_MILITARY_UNIT["2021"]
        } | {self.outpost.outpost_name, "Ак-Суу чек ара заставасы"}
        self.assertEqual({item["outpostName"] for item in results}, expected_names)
        self.assertTrue(all(item["unitNumber"] == "2021" for item in results))
        self.assertTrue(all(item["totalDocuments"] == 0 for item in results[2:]))
        self.assertNotIn(format_outpost_name(foreign_outpost.outpost_name), expected_names)

    def test_outpost_rating_contains_all_outposts_from_own_unit_only(self):
        same_unit_outpost = User.objects.create_user(
            username="rating-own-unit@example.com",
            email="rating-own-unit@example.com",
            password="test-password",
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
            unit_type=User.UnitType.OUTPOST,
            region="2021",
            outpost_name="Own unit outpost",
        )
        foreign_outpost = User.objects.create_user(
            username="rating-foreign-unit@example.com",
            email="rating-foreign-unit@example.com",
            password="test-password",
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
            unit_type=User.UnitType.OUTPOST,
            region="2022",
            outpost_name="Foreign unit outpost",
        )
        ThematicAccountSubmission.objects.bulk_create([
            ThematicAccountSubmission(
                sender=same_unit_outpost,
                unit_number="2021",
                outpost_name=same_unit_outpost.outpost_name,
                document_title="Own unit document",
            ),
            ThematicAccountSubmission(
                sender=foreign_outpost,
                unit_number="2022",
                outpost_name=foreign_outpost.outpost_name,
                document_title="Foreign unit document",
            ),
        ])
        self.client.force_authenticate(self.outpost)

        response = self.client.get(reverse("regional-unit-ratings"), {"period": "all"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {item["unitNumber"] for item in response.data["outposts"]},
            {"2021"},
        )
        outpost_names = {item["outpostName"] for item in response.data["outposts"]}
        self.assertIn(self.outpost.outpost_name, outpost_names)
        self.assertIn("Own unit outpost чек ара заставасы", outpost_names)
        self.assertNotIn("Foreign unit outpost чек ара заставасы", outpost_names)
        self.assertEqual(
            [item["unitNumber"] for item in response.data["results"]],
            ["2021"],
        )
        for item in response.data["outposts"]:
            self.assertEqual(item["criteriaPenalty"], item["failedCriteria"] * 10)
            self.assertEqual(
                item["baseScore"],
                round(max(0, item["rawScore"] - item["criteriaPenalty"]), 1),
            )

        response = self.client.get(reverse("outpost-ratings"), {"period": "all"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {item["unitNumber"] for item in response.data["results"]},
            {"2021"},
        )
        outpost_names = {item["outpostName"] for item in response.data["results"]}
        self.assertIn(self.outpost.outpost_name, outpost_names)
        self.assertIn("Own unit outpost чек ара заставасы", outpost_names)
        self.assertNotIn("Foreign unit outpost чек ара заставасы", outpost_names)

    def test_rating_adds_ten_percent_penalty_one_minute_after_deadline(self):
        submission = ThematicAccountSubmission.objects.create(
            sender=self.outpost,
            unit_number="2021",
            outpost_name=self.outpost.outpost_name,
            document_title="Deadline verification document",
            section_slug="thematic-account",
        )
        before_deadline = timezone.make_aware(datetime(2026, 8, 28, 23, 59))
        one_minute_late = timezone.make_aware(datetime(2026, 8, 29, 0, 1))
        self.client.force_authenticate(self.outpost)

        ThematicAccountSubmission.objects.filter(pk=submission.pk).update(created_at=before_deadline)
        response = self.client.get(reverse("regional-unit-ratings"), {"period": "all"})
        before = next(
            item for item in response.data["outposts"]
            if item["outpostName"] == self.outpost.outpost_name
        )

        ThematicAccountSubmission.objects.filter(pk=submission.pk).update(created_at=one_minute_late)
        response = self.client.get(reverse("regional-unit-ratings"), {"period": "all"})
        after = next(
            item for item in response.data["outposts"]
            if item["outpostName"] == self.outpost.outpost_name
        )

        self.assertEqual(before["deadlineScore"], 100)
        self.assertEqual(after["deadlineScore"], 0)
        self.assertEqual(after["failedCriteria"], before["failedCriteria"] + 1)
        self.assertEqual(after["criteriaPenalty"], before["criteriaPenalty"] + 10)

    def test_outpost_submission_is_visible_only_to_matching_unit(self):
        self.client.force_authenticate(self.outpost)
        response = self.client.post(
            self.url,
            {
                "documentTitle": "Июль айынын тематикалык эсеби",
                "sectionId": "thematic-account",
                "periodId": "period-1",
                "table": {"title": "Сабактардын тематикалык эсеби", "columns": [], "rows": []},
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["unitNumber"], "2021")

        self.client.force_authenticate(self.regional)
        response = self.client.get(self.url)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["documentTitle"], "Июль айынын тематикалык эсеби")

        self.client.force_authenticate(self.other_regional)
        response = self.client.get(self.url)
        self.assertEqual(response.data, [])

    def test_sender_hides_document_only_from_own_account(self):
        submission = ThematicAccountSubmission.objects.create(
            sender=self.outpost,
            unit_number="2021",
            outpost_name=self.outpost.outpost_name,
            document_title="Жеке тизмеден өчүрүлүүчү документ",
            section_slug="thematic-account",
            table_data={"columns": [], "rows": []},
        )
        self.client.force_authenticate(self.outpost)

        hide_response = self.client.post(
            reverse("thematic-account-submission-hide", kwargs={"pk": submission.id})
        )

        self.assertEqual(hide_response.status_code, 204)
        self.assertTrue(ThematicAccountSubmission.objects.filter(pk=submission.id).exists())
        self.assertEqual(self.client.get(self.url).data, [])
        self.assertEqual(
            self.client.get(reverse("dashboard-outpost")).data["home"]["sentDocuments"],
            0,
        )

        self.client.force_authenticate(self.regional)
        regional_documents = self.client.get(self.url).data
        self.assertEqual(len(regional_documents), 1)
        self.assertEqual(regional_documents[0]["id"], submission.id)

    def test_memo_letter_follows_outpost_regional_admin_route(self):
        admin = User.objects.create_user(
            username="memo-admin@example.com",
            email="memo-admin@example.com",
            password="test-password",
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        payload = {
            "documentTitle": "Заставанын билдирме каты",
            "sectionId": "memo-letter",
            "periodId": "memo-outpost-1",
            "table": {"sectionId": "monthly-analysis", "document": {"body": "Кат"}},
        }

        self.client.force_authenticate(self.outpost)
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, 201)
        outpost_registration_number = response.data["registrationNumber"]
        self.assertEqual(outpost_registration_number, response.data["id"])
        outpost_registration_code = response.data["registrationCode"]
        self.assertRegex(
            outpost_registration_code,
            rf'^"\d{{2}}"\d{{2}}"\d{{4}}-ж \d{{2}}/{outpost_registration_number}$',
        )

        self.client.force_authenticate(self.regional)
        response = self.client.get(self.url)
        self.assertEqual([item["documentTitle"] for item in response.data], [payload["documentTitle"]])

        self.client.force_authenticate(admin)
        response = self.client.get(self.url)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["senderRole"], User.Role.OUTPOST)
        self.assertEqual(response.data[0]["table"], payload["table"])

        self.client.force_authenticate(self.outpost)
        response = self.client.post(
            reverse(
                "thematic-account-submission-hide",
                kwargs={"pk": outpost_registration_number},
            )
        )
        self.assertEqual(response.status_code, 204)
        self.assertEqual(self.client.get(self.url).data, [])

        self.client.force_authenticate(self.regional)
        self.assertEqual(len(self.client.get(self.url).data), 1)
        self.client.force_authenticate(admin)
        self.assertEqual(len(self.client.get(self.url).data), 1)

        self.client.force_authenticate(self.regional)
        response = self.client.post(
            self.url,
            {
                **payload,
                "documentTitle": "Аскер бөлүгүнүн билдирме каты",
                "periodId": "memo-regional-1",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        regional_registration_number = response.data["registrationNumber"]
        self.assertNotEqual(regional_registration_number, outpost_registration_number)

        self.client.force_authenticate(admin)
        response = self.client.get(self.url)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(
            {item["senderRole"] for item in response.data},
            {User.Role.OUTPOST, User.Role.REGIONAL},
        )

        response = self.client.get(
            self.url,
            {"registrationNumber": outpost_registration_code},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["documentTitle"], payload["documentTitle"])

    def test_sending_user_created_thematic_document_moves_it_out_of_periods(self):
        library_period_url = reverse("library-period-list")

        for user, section_slug in (
            (self.outpost, "thematic-account"),
            (self.regional, "command-thematic-account"),
        ):
            self.client.force_authenticate(user)
            period_response = self.client.post(
                library_period_url,
                {"section": section_slug, "title": "Document to send"},
                format="json",
            )
            self.assertEqual(period_response.status_code, 201)
            period_slug = period_response.data["id"]

            submission_response = self.client.post(
                self.url,
                {
                    "documentTitle": "Sent document",
                    "sectionId": section_slug,
                    "periodId": period_slug,
                    "table": {"title": "Sent document", "columns": [], "rows": []},
                },
                format="json",
            )

            self.assertEqual(submission_response.status_code, 201)
            self.assertFalse(
                TrainingPeriod.objects.filter(
                    section__slug=section_slug,
                    slug=period_slug,
                ).exists()
            )
            self.assertEqual(submission_response.data["periodId"], period_slug)

    def test_regional_opening_outpost_submission_marks_notification_as_read(self):
        self.client.force_authenticate(self.outpost)
        create_response = self.client.post(
            self.url,
            {
                "documentTitle": "Unread command document",
                "sectionId": "command-thematic-account",
                "periodId": "period-1",
                "table": {"title": "Command training", "columns": [], "rows": []},
            },
            format="json",
        )
        submission_id = create_response.data["id"]

        self.client.force_authenticate(self.regional)
        list_response = self.client.get(self.url)
        self.assertFalse(list_response.data[0]["isRead"])

        read_response = self.client.patch(
            reverse("thematic-account-submission-detail", kwargs={"pk": submission_id}),
            {"isRead": True},
            format="json",
        )
        self.assertEqual(read_response.status_code, 200)
        self.assertTrue(read_response.data["isRead"])

        refreshed_response = self.client.get(self.url)
        self.assertTrue(refreshed_response.data[0]["isRead"])

    def test_matching_regional_unit_can_forward_outpost_document_to_admin(self):
        self.client.force_authenticate(self.outpost)
        response = self.client.post(
            self.url,
            {
                "documentTitle": "Outpost document",
                "sectionId": "lesson-schedule",
                "periodId": "lesson-schedule-week-1",
                "table": {"title": "Schedule", "columns": [], "rows": []},
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        source_id = response.data["id"]

        self.client.force_authenticate(self.regional)
        response = self.client.post(
            reverse("thematic-account-submission-forward", kwargs={"pk": source_id}),
            {"documentTitle": "Regional outgoing document"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["senderRole"], User.Role.REGIONAL)
        self.assertEqual(response.data["documentTitle"], "Regional outgoing document")
        self.assertEqual(response.data["sectionId"], "lesson-schedule")
        self.assertEqual(response.data["table"]["title"], "Schedule")

        admin = User.objects.create_user(
            username="admin@example.com",
            email="admin@example.com",
            password="test-password",
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        self.client.force_authenticate(admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        forwarded = [item for item in response.data if item["senderRole"] == User.Role.REGIONAL]
        self.assertEqual(len(forwarded), 1)
        self.assertEqual(forwarded[0]["documentTitle"], "Regional outgoing document")
        self.assertEqual(forwarded[0]["unitNumber"], "2021")

        response = self.client.get(reverse("dashboard-admin"))
        self.assertEqual(response.status_code, 200)
        expected_unit_numbers = [
            "2021", "2022", "2023", "2024", "2025", "2026", "2027", "2028",
            "2029", "2030", "2031", "2032", "2055", "2056", "2057", "2051",
            "2053", "2063", "2064", "2065", "КЖжАККДБ", "ЧАП",
        ]
        self.assertEqual(response.data["modules"]["library"]["unitNumbers"], expected_unit_numbers)
        self.assertEqual(
            response.data["modules"]["combatTrainingJournal"]["unitNumbers"],
            expected_unit_numbers,
        )
        self.assertEqual(
            response.data["modules"]["combatTrainingResults"]["unitNumbers"],
            expected_unit_numbers,
        )
        self.assertEqual(
            response.data["modules"]["analytics"]["unitNumbers"],
            expected_unit_numbers,
        )

    def test_outpost_can_submit_lesson_schedule(self):
        self.client.force_authenticate(self.outpost)
        response = self.client.post(
            self.url,
            {
                "documentTitle": "Июль айынын сабактар жүгүртмөсү",
                "sectionId": "lesson-schedule",
                "periodId": "lesson-schedule-week-1",
                "table": {"title": "Сабактардын жүгүртмөсү", "columns": [], "rows": []},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["sectionId"], "lesson-schedule")

    def test_meetings_journal_updates_one_document_and_keeps_revision_history(self):
        self.client.force_authenticate(self.regional)
        payload = {
            "documentTitle": "Жыйындын күжүрмөн даярдоо журналы",
            "sectionId": "meetings-combat-training-journal",
            "periodId": "meeting-journal-subject-1",
            "table": {"title": "Журнал", "columns": [], "rows": [{"value": "1"}]},
        }

        first_response = self.client.post(self.url, payload, format="json")
        self.assertEqual(first_response.status_code, 201)
        self.assertEqual(len(first_response.data["revisions"]), 1)

        payload["table"]["rows"] = [{"value": "2"}]
        second_response = self.client.post(self.url, payload, format="json")
        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(second_response.data["id"], first_response.data["id"])
        self.assertEqual(len(second_response.data["revisions"]), 2)
        self.assertEqual(
            second_response.data["revisions"][0]["table"]["rows"][0]["value"],
            "2",
        )

    def test_young_soldier_journal_keeps_update_history(self):
        self.client.force_authenticate(self.regional)
        payload = {
            "documentTitle": "Биринчи жаңылоо",
            "sectionId": "young-soldier-combat-training-journal",
            "periodId": "young-soldier-journal-subject-1",
            "table": {
                "title": "Жаш жоокерлердин журналы",
                "subjectId": 1,
                "columns": [],
                "rows": [],
            },
        }

        first_response = self.client.post(self.url, payload, format="json")
        self.assertEqual(first_response.status_code, 201)

        payload["documentTitle"] = "Экинчи жаңылоо"
        second_response = self.client.post(self.url, payload, format="json")
        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(second_response.data["id"], first_response.data["id"])
        self.assertEqual(
            [item["documentTitle"] for item in second_response.data["revisions"]],
            ["Экинчи жаңылоо", "Биринчи жаңылоо"],
        )

    def test_outpost_can_submit_command_training_table(self):
        self.client.force_authenticate(self.outpost)
        response = self.client.post(
            self.url,
            {
                "documentTitle": "Командирдик даярдоонун тематикалык эсеби",
                "sectionId": "command-thematic-account",
                "periodId": "period-1",
                "table": {"title": "Сабактардын тематикалык эсеби", "columns": [], "rows": []},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["sectionId"], "command-thematic-account")

        self.client.force_authenticate(self.regional)
        response = self.client.get(self.url)
        self.assertEqual(response.data[0]["documentTitle"], "Командирдик даярдоонун тематикалык эсеби")

    def test_regional_unit_can_submit_own_command_training_table_to_admin(self):
        self.client.force_authenticate(self.regional)
        response = self.client.post(
            self.url,
            {
                "documentTitle": "Regional command training document",
                "sectionId": "command-thematic-account",
                "periodId": "period-1",
                "table": {"title": "Command training", "columns": [], "rows": []},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["senderRole"], User.Role.REGIONAL)
        self.assertEqual(response.data["sectionId"], "command-thematic-account")

        admin = User.objects.create_user(
            username="command-admin@example.com",
            email="command-admin@example.com",
            password="test-password",
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        self.client.force_authenticate(admin)
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["documentTitle"], "Regional command training document")
        self.assertEqual(response.data[0]["senderRole"], User.Role.REGIONAL)

    def test_regional_unit_can_submit_meetings_and_young_soldier_documents(self):
        self.client.force_authenticate(self.regional)
        section_ids = [
            "meetings-thematic-account",
            "meetings-lesson-schedule",
            "meetings-combat-training-journal",
            "meetings-observation",
            "meetings-analysis",
            "young-soldier-thematic-account",
            "young-soldier-lesson-schedule",
            "young-soldier-combat-training-journal",
            "young-soldier-observation",
            "young-soldier-analysis",
            "memo-letter",
        ]

        for section_id in section_ids:
            with self.subTest(section_id=section_id):
                response = self.client.post(
                    self.url,
                    {
                        "documentTitle": section_id,
                        "sectionId": section_id,
                        "periodId": f"{section_id}-document",
                        "table": {
                            "title": section_id,
                            "columns": [],
                            "rows": [],
                        },
                    },
                    format="json",
                )
                self.assertEqual(response.status_code, 201)
                self.assertEqual(response.data["sectionId"], section_id)
                self.assertEqual(response.data["unitNumber"], "2021")

    def test_outpost_can_submit_typical_week(self):
        self.client.force_authenticate(self.outpost)
        response = self.client.post(
            self.url,
            {
                "documentTitle": "Бөлүкчөнүн типовая неделясы",
                "sectionId": "typical-week",
                "periodId": "custom-week",
                "table": {"title": "Типтүү жумасы", "columns": [], "rows": []},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["sectionId"], "typical-week")

    def test_outpost_can_submit_personnel_combat_training_journal(self):
        self.client.force_authenticate(self.outpost)
        response = self.client.post(
            self.url,
            {
                "documentTitle": "Июль айынын күжүрмөн даярдоо журналы",
                "sectionId": "combat-training-personnel-journal",
                "periodId": "journal-2026",
                "table": {"title": "Күжүрмөн даярдоону каттоо журналы", "columns": [], "rows": []},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["sectionId"], "combat-training-personnel-journal")
        submission_id = response.data["id"]

        response = self.client.post(
            self.url,
            {
                "documentTitle": "Июль айынын күжүрмөн даярдоо журналы",
                "sectionId": "combat-training-personnel-journal",
                "periodId": "journal-2026",
                "table": {
                    "title": "Күжүрмөн даярдоону каттоо журналы",
                    "columns": [],
                    "rows": [{"number": 1, "hours": "2"}],
                },
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("updatedAt", response.data)
        self.assertEqual(CombatTrainingJournalRevision.objects.count(), 2)
        self.assertEqual(len(response.data["revisions"]), 2)
        self.assertEqual(response.data["revisions"][0]["table"]["rows"][0]["hours"], "2")
        self.assertEqual(response.data["revisions"][1]["table"]["rows"], [])

        revision_id = response.data["revisions"][0]["id"]
        self.client.force_authenticate(self.regional)
        read_response = self.client.patch(
            reverse("combat-training-journal-revision-detail", args=[revision_id]),
            {"isRead": True},
            format="json",
        )
        self.assertEqual(read_response.status_code, 200)
        self.assertTrue(read_response.data["isRead"])

        list_response = self.client.get(self.url)
        self.assertTrue(list_response.data[0]["revisions"][0]["isRead"])

        delete_response = self.client.delete(
            reverse("combat-training-journal-revision-detail", args=[revision_id])
        )
        self.assertEqual(delete_response.status_code, 204)
        self.assertEqual(CombatTrainingJournalRevision.objects.count(), 2)

        regional_list_response = self.client.get(self.url)
        self.assertEqual(len(regional_list_response.data[0]["revisions"]), 1)

        self.client.force_authenticate(self.outpost)
        response = self.client.get(self.url)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(len(response.data[0]["revisions"]), 2)
        self.assertEqual(response.data[0]["documentTitle"], "Июль айынын күжүрмөн даярдоо журналы")
        self.assertEqual(response.data[0]["table"]["rows"][0]["hours"], "2")

        self.client.force_authenticate(self.regional)
        forward_response = self.client.post(
            reverse("thematic-account-submission-forward", kwargs={"pk": submission_id}),
            {"documentTitle": "Аскер бөлүгүнөн жөнөтүлгөн журнал"},
            format="json",
        )
        self.assertEqual(forward_response.status_code, 201)
        self.assertEqual(len(forward_response.data["revisions"]), 2)

    def test_regional_unit_can_submit_command_training_journal_to_admin(self):
        self.client.force_authenticate(self.regional)
        response = self.client.post(
            self.url,
            {
                "documentTitle": "Command training journal",
                "sectionId": "combat-training-command-journal",
                "periodId": "command-journal-2026",
                "table": {
                    "title": "Command training registration journal",
                    "columns": [],
                    "rows": [{"number": 1, "hours": "4"}],
                },
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["senderRole"], User.Role.REGIONAL)
        self.assertEqual(response.data["sectionId"], "combat-training-command-journal")

        admin = User.objects.create_user(
            username="journal-admin@example.com",
            email="journal-admin@example.com",
            password="test-password",
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        self.client.force_authenticate(admin)
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["documentTitle"], "Command training journal")
        self.assertEqual(response.data[0]["table"]["rows"][0]["hours"], "4")

    def test_observation_subjects_are_grouped_in_one_result_document(self):
        self.client.force_authenticate(self.outpost)
        for subject_id, subject_title in (("observation-tpv", "ТПВ"), ("observation-ogp", "ОГП")):
            response = self.client.post(
                self.url,
                {
                    "documentTitle": "Март айынын көзөмөл сабактары",
                    "sectionId": "combat-training-results-observation",
                    "periodId": "",
                    "table": {
                        "subjectId": subject_id,
                        "subjectTitle": subject_title,
                        "periodId": f"{subject_id}-march",
                        "periodTitle": "март",
                        "table": {"title": subject_title, "columns": [], "rows": []},
                    },
                },
                format="json",
            )
            self.assertIn(response.status_code, (200, 201))

        self.client.force_authenticate(self.regional)
        response = self.client.get(self.url)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(
            set(response.data[0]["table"]["subjects"]),
            {"observation-tpv", "observation-ogp"},
        )

        submission_id = response.data[0]["id"]
        self.client.force_authenticate(self.outpost)
        detail_url = reverse(
            "thematic-account-submission-detail",
            kwargs={"pk": submission_id},
        )
        response = self.client.delete(f"{detail_url}?subjectId=observation-tpv")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            set(response.data["table"]["subjects"]),
            {"observation-ogp"},
        )

    def test_regional_observation_subjects_are_grouped_for_admin(self):
        self.client.force_authenticate(self.regional)
        for subject_id in ("observation-tpv", "observation-ogp"):
            response = self.client.post(
                self.url,
                {
                    "documentTitle": "Regional observation results",
                    "sectionId": "combat-training-results-observation",
                    "periodId": "",
                    "table": {
                        "subjectId": subject_id,
                        "subjectTitle": subject_id,
                        "periodId": f"{subject_id}-period",
                        "periodTitle": "period",
                        "table": {"title": subject_id, "columns": [], "rows": []},
                    },
                },
                format="json",
            )
            self.assertIn(response.status_code, (200, 201))

        admin = User.objects.create_user(
            username="observation-admin@example.com",
            email="observation-admin@example.com",
            password="test-password",
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        self.client.force_authenticate(admin)
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["documentTitle"], "Regional observation results")
        self.assertEqual(response.data[0]["senderRole"], User.Role.REGIONAL)
        self.assertEqual(
            set(response.data[0]["table"]["subjects"]),
            {"observation-tpv", "observation-ogp"},
        )

    def test_outpost_can_submit_inspection_result_to_matching_unit(self):
        self.client.force_authenticate(self.outpost)
        response = self.client.post(
            self.url,
            {
                "documentTitle": "Окуу жылынын жыйынтыгы",
                "sectionId": "combat-training-results-inspection",
                "periodId": "",
                "table": {
                    "subsectionId": "inspection-summary-1",
                    "subsectionTitle": "Окуу жылына карата жыйынтык ведомосту",
                    "periodId": "inspection-summary-1-period-1",
                    "periodTitle": "1-ай",
                    "table": {"title": "Сводная ведомость", "columns": [], "rows": []},
                },
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["sectionId"], "combat-training-results-inspection")

        self.client.force_authenticate(self.regional)
        response = self.client.get(self.url)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["table"]["subsectionId"], "inspection-summary-1")

        self.client.force_authenticate(self.other_regional)
        self.assertEqual(self.client.get(self.url).data, [])

    def test_outpost_can_submit_combat_training_analysis(self):
        self.client.force_authenticate(self.outpost)
        response = self.client.post(
            self.url,
            {
                "documentTitle": "Июль айынын талдоосу",
                "sectionId": "combat-training-analysis",
                "periodId": "monthly-analysis",
                "table": {
                    "sectionId": "monthly-analysis",
                    "sectionTitle": "Айдын талдоосу",
                    "document": {"title": "Июль", "body": "Талдоонун тексти"},
                },
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.client.force_authenticate(self.regional)
        response = self.client.get(self.url)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["table"]["document"]["body"], "Талдоонун тексти")

    def test_regional_unit_can_submit_own_combat_training_analysis(self):
        self.client.force_authenticate(self.regional)
        response = self.client.post(
            self.url,
            {
                "documentTitle": "Аскер бөлүктүн жылдык талдоосу",
                "sectionId": "combat-training-analysis-regional",
                "periodId": "year-analysis",
                "table": {
                    "sectionId": "year-analysis",
                    "sectionTitle": "Окуу жылынын талдоосу",
                    "document": {"title": "Жылдык талдоо", "body": "Жыйынтык"},
                },
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["sectionId"], "combat-training-analysis-regional")

        admin = User.objects.create_user(
            username="analysis-admin@example.com",
            email="analysis-admin@example.com",
            password="test-password",
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        self.client.force_authenticate(admin)
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["senderRole"], User.Role.REGIONAL)
        self.assertEqual(response.data[0]["table"]["sectionId"], "year-analysis")
        self.assertEqual(response.data[0]["table"]["document"]["body"], "Жыйынтык")

    def test_matching_regional_unit_can_delete_personnel_training_submissions(self):
        for section_id in ("thematic-account", "lesson-schedule"):
            self.client.force_authenticate(self.outpost)
            response = self.client.post(
                self.url,
                {
                    "documentTitle": f"Өчүрүлүүчү документ: {section_id}",
                    "sectionId": section_id,
                    "periodId": "period-1",
                    "table": {"title": "Таблица", "columns": [], "rows": []},
                },
                format="json",
            )
            detail_url = reverse(
                "thematic-account-submission-detail",
                kwargs={"pk": response.data["id"]},
            )

            self.client.force_authenticate(self.other_regional)
            self.assertEqual(self.client.delete(detail_url).status_code, 403)

            self.client.force_authenticate(self.regional)
            self.assertEqual(self.client.delete(detail_url).status_code, 204)

        self.assertEqual(self.client.get(self.url).data, [])

    def test_sender_outpost_can_still_delete_own_submission(self):
        self.client.force_authenticate(self.outpost)
        response = self.client.post(
            self.url,
            {
                "documentTitle": "Өчүрүлүүчү документ",
                "sectionId": "command-thematic-account",
                "periodId": "period-1",
                "table": {"title": "Сабактардын тематикалык эсеби", "columns": [], "rows": []},
            },
            format="json",
        )
        detail_url = reverse(
            "thematic-account-submission-detail",
            kwargs={"pk": response.data["id"]},
        )

        self.assertEqual(self.client.delete(detail_url).status_code, 204)

    def test_sender_can_request_edit_permission_and_admin_can_approve(self):
        self.client.force_authenticate(self.outpost)
        response = self.client.post(
            self.url,
            {
                "documentTitle": "Document awaiting correction",
                "sectionId": "thematic-account",
                "periodId": "period-1",
                "table": {"title": "Table", "columns": [], "rows": []},
            },
            format="json",
        )
        submission_id = response.data["id"]
        response = self.client.post(
            reverse("submission-edit-request-create", kwargs={"pk": submission_id}),
            {},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], "pending")

        admin = User.objects.create_user(
            username="edit-request-admin@example.com",
            email="edit-request-admin@example.com",
            password="test-password",
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        self.client.force_authenticate(admin)
        response = self.client.patch(
            reverse("submission-edit-request-decision", kwargs={"pk": response.data["id"]}),
            {"status": "approved"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "approved")
        self.assertTrue(response.data["submission"]["canEdit"])

        self.client.force_authenticate(self.outpost)
        response = self.client.get(self.url)
        self.assertEqual(response.data[0]["editRequestStatus"], "approved")
        self.assertTrue(response.data[0]["canEdit"])

        response = self.client.patch(
            reverse("thematic-account-submission-detail", kwargs={"pk": submission_id}),
            {
                "documentTitle": "Corrected document",
                "table": {
                    "title": "Corrected table",
                    "columns": [{"key": "topic", "label": "Topic"}],
                    "rows": [{"topic": "Corrected value"}],
                },
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["documentTitle"], "Corrected document")
        self.assertEqual(response.data["table"]["rows"][0]["topic"], "Corrected value")
        self.assertFalse(response.data["canEdit"])
        self.assertEqual(response.data["editRequestStatus"], "corrected")

        self.client.force_authenticate(admin)
        admin_submissions = self.client.get(self.url).data
        corrected_submission = next(
            item for item in admin_submissions if item["id"] == submission_id
        )
        self.assertEqual(corrected_submission["documentTitle"], "Corrected document")
        self.assertTrue(corrected_submission["isCorrected"])
        edit_requests = self.client.get(reverse("submission-edit-request-list")).data
        corrected_request = next(
            item for item in edit_requests if item["submission"]["id"] == submission_id
        )
        self.assertEqual(corrected_request["status"], "corrected")
        self.assertEqual(
            corrected_request["submission"]["documentTitle"],
            "Corrected document",
        )

    def test_admin_can_delete_only_processed_edit_requests(self):
        self.client.force_authenticate(self.outpost)
        submission = self.client.post(
            self.url,
            {
                "documentTitle": "Request to remove",
                "sectionId": "thematic-account",
                "periodId": "period-1",
                "table": {"title": "Table", "columns": [], "rows": []},
            },
            format="json",
        )
        edit_request = self.client.post(
            reverse("submission-edit-request-create", kwargs={"pk": submission.data["id"]}),
            {},
            format="json",
        )
        request_url = reverse(
            "submission-edit-request-decision",
            kwargs={"pk": edit_request.data["id"]},
        )
        admin = User.objects.create_user(
            username="delete-edit-request-admin@example.com",
            email="delete-edit-request-admin@example.com",
            password="test-password",
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        self.client.force_authenticate(admin)

        self.assertEqual(self.client.delete(request_url).status_code, 400)
        self.assertEqual(
            self.client.patch(request_url, {"status": "rejected"}, format="json").status_code,
            200,
        )
        self.assertEqual(self.client.delete(request_url).status_code, 204)
        self.assertEqual(self.client.get(reverse("submission-edit-request-list")).data, [])
