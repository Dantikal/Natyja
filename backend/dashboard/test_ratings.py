from django.urls import reverse
from rest_framework.test import APITestCase
from accounts.models import User
from accounts.outposts import OUTPOSTS_BY_MILITARY_UNIT, format_outpost_name


class OwnOutpostRatingTests(APITestCase):
    def test_regional_sees_all_own_directory_and_registered_outposts(self):
        def user(name, role="outpost", region="2021", status="active", unit_type="outpost"):
            return User.objects.create_user(username=name, email=f"{name}@example.com",
                role=role, region=region, status=status, unit_type=unit_type, outpost_name=name)

        regional = user("regional", role="regional", unit_type="regional_department")
        own = user("own")
        user("other", region="2022")
        user("inactive", status="pending")
        user("training", unit_type="training_center_head")
        self.client.force_authenticate(regional)
        response = self.client.get(reverse("regional-unit-ratings"), {"period": "all", "scope": "own-outposts"})
        self.assertEqual(response.status_code, 200)
        expected_names = {format_outpost_name(name) for name in OUTPOSTS_BY_MILITARY_UNIT["2021"]}
        expected_names.add(format_outpost_name(own.outpost_name))
        self.assertEqual({item["outpostName"] for item in response.data["outposts"]}, expected_names)
        self.assertTrue(all(item["unitNumber"] == "2021" for item in response.data["outposts"]))
        directory_outposts = [item for item in response.data["outposts"] if item["outpostName"] != format_outpost_name(own.outpost_name)]
        self.assertTrue(all(item["score"] == 0 and item["totalDocuments"] == 0 for item in directory_outposts))
        self.assertEqual(response.data["outposts"][0]["unitNumber"], "2021")
        self.assertEqual(response.data["outposts"][0]["rank"], 1)
        self.assertIn("score", response.data["outposts"][0])
