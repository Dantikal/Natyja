from pathlib import Path
import tempfile
from unittest.mock import patch
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from accounts.models import User
from methodical.models import MethodicalManualSubject, MethodicalManualDocument
from methodical.legacy_preview import LegacyPreviewError
from methodical.serializers import MethodicalManualDocumentSerializer

class LegacyWordPreviewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="preview", email="preview@example.test", password="test", status="active", role="outpost")
        self.subject = MethodicalManualSubject.objects.create(title="Preview")
        self.document = MethodicalManualDocument.objects.create(subject=self.subject, title="Legacy Word", file="test.doc", original_name="test.doc")
        self.url = reverse("methodical-word-preview", args=[self.subject.pk, self.document.pk])

    def test_authentication_required(self):
        with patch("methodical.legacy_preview.legacy_word_preview") as convert:
            self.assertIn(self.client.get(self.url).status_code, (401,403))
            convert.assert_not_called()

    def test_inline_preview_and_conversion_error(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(MethodicalManualDocumentSerializer(self.document).data["kind"], "doc")
        with tempfile.TemporaryDirectory() as folder:
            preview = Path(folder) / "preview.docx"
            preview.write_bytes(b"preview")
            with patch("methodical.legacy_preview.legacy_word_preview", return_value=preview):
                response = self.client.get(self.url)
                self.assertEqual(response.status_code,200)
                self.assertTrue(response["Content-Disposition"].startswith("inline"))
                self.assertEqual(b"".join(response.streaming_content),b"preview")
                response.close()
        with patch("methodical.legacy_preview.legacy_word_preview", side_effect=LegacyPreviewError("Cannot read document")):
            self.assertEqual(self.client.get(self.url).status_code,503)
