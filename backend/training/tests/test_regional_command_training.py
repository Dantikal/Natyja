from copy import deepcopy

from django.test import SimpleTestCase

from training.services import add_regional_command_training_groups
from training.services import add_regional_typical_week_groups


class RegionalCommandTrainingGroupsTests(SimpleTestCase):
    def test_adds_two_groups_and_preserves_command_training_contents(self):
        command_sections = [
            {"id": "command-thematic-account", "title": "Сабактардын тематикалык эсеби"},
            {"id": "command-lesson-schedule", "title": "Сабактардын жүгүртмөсү"},
        ]
        sections = [
            {
                "id": "command-training",
                "title": "Командирдик даярдоо",
                "sections": deepcopy(command_sections),
            }
        ]

        result = add_regional_command_training_groups(sections)
        groups = result[0]["sections"]

        self.assertEqual(
            [group["title"] for group in groups],
            [
                "Бөлүкчөлөрдүн командирдик даярдоосу",
                "Аскер бөлүктүн командирдик даярдоосу",
            ],
        )
        self.assertTrue(all(group["sections"] == command_sections for group in groups))
        self.assertIsNot(groups[0]["sections"], groups[1]["sections"])

    def test_adds_two_typical_week_groups(self):
        sections = [{"id": "typical-week", "title": "Типтүү жумасы"}]

        result = add_regional_typical_week_groups(sections)

        self.assertEqual(
            result[0]["sections"],
            [
                {
                    "id": "typical-week-subunits",
                    "title": "Бөлүкчөлөрдүн типтуу жумасы",
                },
                {
                    "id": "typical-week-military-unit",
                    "title": "Аскер бөлүктүн типтуу жумасы",
                },
            ],
        )
