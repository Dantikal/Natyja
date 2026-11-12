from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase
from accounts.models import User


class TrainingWorkflowTests(APITestCase):
    def setUp(self):
        self.regional = self.user("regional", "regional_department", role="regional")
        self.center = self.user("center", "training_center_head")
        self.other_center = self.user("other-center", "training_center_head")
        self.platoon = self.user("platoon", "training_platoon_commander", training_center=self.center)
        self.other_platoon = self.user("other-platoon", "training_platoon_commander", training_center=self.other_center)
        self.outpost = self.user("outpost", "outpost")

    def user(self, name, unit_type, role="outpost", **extra):
        return User.objects.create_user(username=name, email=f"{name}@example.com", role=role,
            unit_type=unit_type, region="2026", outpost_name="№ 1 окуу взводу" if unit_type == "training_platoon_commander" else name,
            status="active", last_login=timezone.now(), **extra)

    def docs(self, user):
        self.client.force_authenticate(user)
        response = self.client.get(reverse("thematic-account-submission-list"))
        self.assertEqual(response.status_code, 200)
        return {item["id"] for item in response.data}

    def test_documents_follow_platoon_center_regional_chain(self):
        self.client.force_authenticate(self.platoon)
        response = self.client.post(reverse("thematic-account-submission-list"), {
            "sectionId": "shooting-statements", "documentTitle": "Ведомость", "table": {"rows": []}
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        pk = response.data["id"]
        self.assertIn(pk, self.docs(self.center))
        for outsider in [self.regional, self.other_center, self.other_platoon]:
            self.assertNotIn(pk, self.docs(outsider))
            response = self.client.patch(reverse("thematic-account-submission-detail", args=[pk]), {}, format="json")
            self.assertEqual(response.status_code, 403)
        self.client.force_authenticate(self.center)
        self.assertEqual(self.client.patch(reverse("thematic-account-submission-detail", args=[pk]), {}, format="json").status_code, 200)
        response = self.client.post(reverse("thematic-account-submission-forward", args=[pk]), {"documentTitle": "Центр ведомость"}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        forwarded = response.data["id"]
        self.assertEqual(response.data["senderUnitType"], "training_center_head")
        self.assertEqual(response.data["outpostName"], self.center.outpost_name)
        self.assertIn(forwarded, self.docs(self.regional))
        self.assertNotIn(forwarded, self.docs(self.platoon))
        self.assertNotIn(forwarded, self.docs(self.other_center))

    def test_own_center_document_goes_to_military_unit(self):
        self.client.force_authenticate(self.center)
        response = self.client.post(reverse("thematic-account-submission-list"), {
            "sectionId": "memo-letter", "documentTitle": "Билдирме", "table": {"text": "Документ"}
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertIn(response.data["id"], self.docs(self.regional))

    def test_chat_is_limited_to_linked_center_and_platoons(self):
        for user, expected in [(self.center, self.platoon), (self.platoon, self.center)]:
            self.client.force_authenticate(user)
            response = self.client.get(reverse("chat-partners"))
            self.assertEqual({item["id"] for item in response.data}, {expected.pk})
            response = self.client.post(reverse("admin-chat-messages"), {"recipientId": expected.pk, "body": "Тест"}, format="json")
            self.assertEqual(response.status_code, 201, response.data)
            for wrong in [self.other_center, self.other_platoon, self.regional]:
                response = self.client.post(reverse("admin-chat-messages"), {"recipientId": wrong.pk, "body": "Тест"}, format="json")
                self.assertEqual(response.status_code, 400)
            self.assertEqual(self.client.post(reverse("admin-chat-messages"), {"body": "Тест"}, format="json").status_code, 400)

    def test_peer_ratings_are_separate_and_do_not_merge_identical_platoon_names(self):
        for viewer, expected in [(self.center, {self.center.pk, self.other_center.pk}),
                                 (self.platoon, {self.platoon.pk, self.other_platoon.pk})]:
            self.client.force_authenticate(viewer)
            response = self.client.get(reverse("regional-unit-ratings"), {"period": "all"})
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual({item["userId"] for item in response.data["outposts"]}, expected)
            self.assertEqual(response.data["results"], [])
            self.assertTrue(all(item["unitType"] == viewer.unit_type for item in response.data["outposts"]))

    def test_directory_has_centers_for_regional_and_only_own_platoons_for_head(self):
        self.client.force_authenticate(self.regional)
        response = self.client.get(reverse("combat-training-journal-outpost-list"))
        self.assertIn(self.center.pk, {item["id"] for item in response.data})
        self.assertNotIn(self.platoon.pk, {item["id"] for item in response.data})
        self.client.force_authenticate(self.center)
        response = self.client.get(reverse("combat-training-journal-outpost-list"))
        self.assertEqual({item["id"] for item in response.data}, {self.platoon.pk})
