from unittest.mock import patch
from datetime import datetime
from zoneinfo import ZoneInfo

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.test import APIClient, APITestCase

from accounts.models import User
from submissions.models import CombatTrainingJournalRevision, SubmissionArchiveCopy, ThematicAccountSubmission


class DocumentWorkflowTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.password = "workflow-test-password"
        cls.outpost = User.objects.create_user(
            username="workflow-outpost", email="workflow-outpost@example.com",
            password=cls.password, role=User.Role.OUTPOST, status=User.Status.ACTIVE,
            region="2021", outpost_name="Жаштык чек ара заставасы",
        )
        cls.regional = User.objects.create_user(
            username="workflow-regional", email="workflow-regional@example.com",
            password=cls.password, role=User.Role.REGIONAL, status=User.Status.ACTIVE,
            region="2021",
        )
        cls.other_regional = User.objects.create_user(
            username="workflow-other", email="workflow-other@example.com",
            password=cls.password, role=User.Role.REGIONAL, status=User.Status.ACTIVE,
            region="2022",
        )
        cls.admin = User.objects.create_superuser(
            username="workflow-admin", email="workflow-admin@example.com", password=cls.password,
        )

    def login(self, user):
        client = APIClient()
        response = client.post(reverse("login"), {
            "email": user.email, "password": self.password,
        }, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        return client

    def test_admin_archive_includes_all_users_and_preserves_personal_scope(self):
        for sender in (self.outpost, self.regional, self.other_regional):
            SubmissionArchiveCopy.objects.create(
                source_submission_id=123, sender_id_snapshot=sender.id,
                sender_name=sender.full_name, unit_number=sender.region,
                outpost_name=sender.outpost_name, document_title="Архив",
                section_slug="lesson-schedule", table_data={"rows": []}, year=2026,
            )
        url = reverse("submission-archive-list")
        admin = self.login(self.admin)
        response = admin.get(url, {"scope": "admin"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 3)
        self.assertEqual({item["unitNumber"] for item in response.data}, {"2021", "2022"})
        self.assertEqual({item["senderRole"] for item in response.data}, {"outpost", "regional"})
        self.assertEqual(admin.get(url).data, [])
        self.assertEqual(admin.get(url, {"scope": "admin", "sectionId": "memo-letter"}).data, [])
        for sender in (self.outpost, self.regional):
            client = self.login(sender)
            self.assertEqual(client.get(url, {"scope": "admin"}).status_code, 403)
            self.assertEqual(len(client.get(url).data), 1)
        self.assertEqual(APIClient().get(url, {"scope": "admin"}).status_code, 401)

    def test_archive_pages_omit_document_bodies_and_keep_cursor_and_permissions(self):
        copies = [SubmissionArchiveCopy.objects.create(
            source_submission_id=123, sender_id_snapshot=self.outpost.id,
            document_title=f"Archive {index}", section_slug="combat-training-analysis",
            table_data={"sectionId": "monthly-analysis", "rows": ["large body"]}, year=2026,
        ) for index in range(3)]
        url = reverse("submission-archive-list")
        client = self.login(self.admin)
        params = {"scope": "admin", "metadata": "1", "limit": "2"}
        response = client.get(url, params)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data["results"]], [copies[2].pk, copies[1].pk])
        self.assertEqual(response.data["results"][0]["table"], {"sectionId": "monthly-analysis"})
        params["beforeId"] = response.data["nextCursor"]
        last = client.get(url, params).data
        self.assertEqual([item["id"] for item in last["results"]], [copies[0].pk])
        self.assertIsNone(last["nextCursor"])
        detail = client.get(url, {"scope": "admin", "copyId": copies[0].pk})
        self.assertEqual(detail.data[0]["table"]["rows"], ["large body"])
        self.assertEqual(self.login(self.regional).get(url, {"copyId": copies[0].pk}).data, [])
        self.assertEqual(self.login(self.outpost).get(url, params).status_code, 403)
        self.assertEqual(client.get(url, {"metadata": "1", "limit": "invalid"}).status_code, 400)

    def test_submission_pages_keep_sender_permissions(self):
        items = [ThematicAccountSubmission.objects.create(sender=self.outpost, document_title=f"doc {i}", section_slug="lesson-schedule", table_data={"rows": []}, unit_number="2021") for i in range(3)]
        client = self.login(self.outpost)
        url = reverse("thematic-account-submission-list")
        params = {"paged": "1", "limit": "2"}
        first = client.get(url, params).data
        self.assertEqual([item["id"] for item in first["results"]], [items[2].pk, items[1].pk])
        params["beforeId"] = first["nextCursor"]
        last = client.get(url, params).data
        self.assertEqual([item["id"] for item in last["results"]], [items[0].pk])
        self.assertIsNone(last["nextCursor"])
        self.assertEqual(self.login(self.other_regional).get(url, {"paged": "1"}).data["results"], [])

    def test_annual_draft_archiving_is_immutable_owned_and_idempotent(self):
        from datetime import date
        client = self.login(self.outpost)
        url = reverse("submission-archive-list")
        payload = {"kind": "annual-draft", "key": "draft-1", "year": 2026,
                   "sectionId": "thematic-account", "documentTitle": "2026 report",
                   "table": {"rows": [{"topic": "original"}]}, "sender_id_snapshot": self.admin.pk}
        with patch("submissions.views.timezone.localdate", return_value=date(2027, 1, 1)):
            first = client.post(url, payload, format="json")
            self.assertEqual(first.status_code, 201)
            payload["table"] = {"rows": []}
            second = client.post(url, payload, format="json")
            self.assertEqual(second.status_code, 200)
            self.assertEqual(first.data["id"], second.data["id"])
            payload["year"] = 2027
            self.assertEqual(client.post(url, payload, format="json").status_code, 400)
        archived = SubmissionArchiveCopy.objects.get(pk=first.data["id"])
        self.assertEqual(archived.sender_id_snapshot, self.outpost.pk)
        self.assertEqual(archived.table_data["rows"], [{"topic": "original"}])

    def test_jwt_login_send_receive_forward_approve_and_correct(self):
        outpost = self.login(self.outpost)
        regional = self.login(self.regional)
        admin = self.login(self.admin)
        other = self.login(self.other_regional)
        for client, route in [
            (outpost, "dashboard-outpost"),
            (regional, "dashboard-regional"),
            (admin, "dashboard-admin"),
        ]:
            response = client.get(reverse(route))
            self.assertEqual(response.status_code, 200, response.data)
            self.assertIn("modules", response.data)

        url = reverse("thematic-account-submission-list")
        table = {"title": "Жүгүртмө", "columns": [{"key": "topic", "label": "Тема"}],
                 "rows": [{"topic": "Чек ара даярдыгы"}]}
        sent = outpost.post(url, {
            "documentTitle": "Текшерүү документи", "sectionId": "lesson-schedule",
            "periodId": "workflow-week", "table": table,
        }, format="json")
        self.assertEqual(sent.status_code, 201, sent.data)
        source_id = sent.data["id"]
        self.assertEqual(sent.data["table"], table)
        self.assertEqual(other.get(url).data, [])
        received = regional.get(url)
        self.assertEqual(received.status_code, 200)
        self.assertEqual(received.data[0]["id"], source_id)
        self.assertEqual(received.data[0]["table"], table)

        forwarded = regional.post(reverse("thematic-account-submission-forward", kwargs={"pk": source_id}), {
            "documentTitle": "Аскер бөлүгүнүн документи",
        }, format="json")
        self.assertEqual(forwarded.status_code, 201, forwarded.data)
        self.assertNotEqual(forwarded.data["id"], source_id)
        self.assertEqual(forwarded.data["table"], table)
        admin_received = admin.get(url)
        self.assertEqual(admin_received.status_code, 200)
        self.assertIn(forwarded.data["id"], [item["id"] for item in admin_received.data])

        edit = outpost.post(reverse("submission-edit-request-create", kwargs={"pk": source_id}), {}, format="json")
        self.assertEqual(edit.status_code, 201, edit.data)
        approved = admin.patch(reverse("submission-edit-request-decision", kwargs={"pk": edit.data["id"]}), {
            "status": "approved",
        }, format="json")
        self.assertEqual(approved.status_code, 200, approved.data)
        corrected_table = {**table, "rows": [{"topic": "Жаңыртылган тема"}]}
        corrected = outpost.patch(reverse("thematic-account-submission-detail", kwargs={"pk": source_id}), {
            "documentTitle": "Оңдолгон документ", "table": corrected_table,
        }, format="json")
        self.assertEqual(corrected.status_code, 200, corrected.data)
        self.assertTrue(corrected.data["isCorrected"])
        received = next(item for item in regional.get(url).data if item["id"] == source_id)
        self.assertEqual(received["table"], corrected_table)
        # A forwarded document is a snapshot; correcting the source cannot change it.
        self.assertEqual(ThematicAccountSubmission.objects.get(pk=forwarded.data["id"]).table_data, table)

    def test_failed_journal_send_rolls_back_document_and_revision(self):
        client = self.login(self.outpost)
        with patch.object(CombatTrainingJournalRevision.objects, "create", side_effect=RuntimeError("Simulated save failure")):
            with self.assertRaises(RuntimeError):
                client.post(reverse("thematic-account-submission-list"), {
                    "documentTitle": "Журнал", "sectionId": "combat-training-personnel-journal",
                    "periodId": "workflow-journal", "table": {"rows": []},
                }, format="json")
        self.assertFalse(ThematicAccountSubmission.objects.exists())
        self.assertFalse(CombatTrainingJournalRevision.objects.exists())
        self.assertFalse(SubmissionArchiveCopy.objects.exists())

    def test_archive_keeps_read_only_copies_after_correction_and_deletion(self):
        outpost = self.login(self.outpost)
        admin = self.login(self.admin)
        archive_url = reverse("submission-archive-list")
        table = {"columns": [{"key": "topic", "label": "Тема"}], "rows": [{"topic": "Биринчи"}]}
        sent = outpost.post(reverse("thematic-account-submission-list"), {
            "documentTitle": "Документ", "sectionId": "lesson-schedule",
            "periodId": "test-week", "table": table,
        }, format="json")
        self.assertEqual(sent.status_code, 201)
        self.assertEqual(outpost.get(archive_url).data[0]["table"], table)
        self.assertEqual(self.login(self.regional).get(archive_url).data, [])

        edit = outpost.post(reverse("submission-edit-request-create", kwargs={"pk": sent.data["id"]}), {}, format="json")
        admin.patch(reverse("submission-edit-request-decision", kwargs={"pk": edit.data["id"]}), {"status": "approved"}, format="json")
        corrected = {**table, "rows": [{"topic": "Экинчи"}]}
        outpost.patch(reverse("thematic-account-submission-detail", kwargs={"pk": sent.data["id"]}), {
            "documentTitle": "Оңдолгон документ", "table": corrected,
        }, format="json")
        copies = outpost.get(archive_url, {"sectionId": "lesson-schedule"}).data
        self.assertEqual(len(copies), 2)
        self.assertEqual(copies[0]["table"], corrected)
        self.assertEqual(copies[1]["table"], table)
        self.assertEqual(copies[0]["year"], copies[1]["year"])
        self.assertEqual(outpost.post(archive_url, {}).status_code, 400)

        outpost.delete(reverse("thematic-account-submission-detail", kwargs={"pk": sent.data["id"]}))
        self.assertEqual(len(outpost.get(archive_url).data), 2)

    def test_new_year_submission_is_placed_in_new_year_archive(self):
        client = self.login(self.outpost)
        with patch("submissions.archive.timezone.now", return_value=datetime(2027, 1, 1, 0, 1, tzinfo=ZoneInfo("Asia/Bishkek"))):
            response = client.post(reverse("thematic-account-submission-list"), {
                "documentTitle": "Жаңы жыл", "sectionId": "lesson-schedule",
                "table": {"rows": []},
            }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(client.get(reverse("submission-archive-list")).data[0]["year"], 2027)

    def test_failed_journal_forward_keeps_source_without_partial_copy(self):
        source = ThematicAccountSubmission.objects.create(
            sender=self.outpost, unit_number="2021", outpost_name=self.outpost.outpost_name,
            document_title="Журнал", section_slug="combat-training-personnel-journal",
            table_data={"rows": [{"topic": "Original"}]},
        )
        revision = CombatTrainingJournalRevision.objects.create(
            submission=source, document_title=source.document_title, table_data=source.table_data,
        )
        client = self.login(self.regional)
        with patch.object(CombatTrainingJournalRevision.objects, "bulk_create", side_effect=RuntimeError("Simulated save failure")):
            with self.assertRaises(RuntimeError):
                client.post(reverse("thematic-account-submission-forward", kwargs={"pk": source.pk}), {
                    "documentTitle": "Forwarded journal",
                }, format="json")
        self.assertEqual(list(ThematicAccountSubmission.objects.values_list("pk", flat=True)), [source.pk])
        self.assertEqual(list(CombatTrainingJournalRevision.objects.values_list("pk", flat=True)), [revision.pk])
        source.refresh_from_db()
        self.assertEqual(source.table_data, {"rows": [{"topic": "Original"}]})

    def test_document_list_does_not_query_edit_requests_for_each_document(self):
        client = APIClient()
        client.force_authenticate(self.regional)
        ThematicAccountSubmission.objects.create(
            sender=self.outpost, unit_number="2021", document_title="Document 1",
            section_slug="lesson-schedule", table_data={"rows": []},
        )
        with CaptureQueriesContext(connection) as single_queries:
            response = client.get(reverse("thematic-account-submission-list"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        ThematicAccountSubmission.objects.bulk_create([
            ThematicAccountSubmission(
                sender=self.outpost, unit_number="2021", document_title=f"Document {number}",
                section_slug="lesson-schedule", table_data={"rows": []},
            ) for number in range(2, 26)
        ])
        with CaptureQueriesContext(connection) as many_queries:
            response = client.get(reverse("thematic-account-submission-list"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 25)
        self.assertEqual(len(many_queries), len(single_queries))
