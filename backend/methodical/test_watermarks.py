import io
from types import SimpleNamespace
from django.test import SimpleTestCase
from reportlab.pdfgen import canvas
from pypdf import PdfReader
from methodical.watermarks import stamp_pdf
class WatermarkTests(SimpleTestCase):
 def test_identity_on_each_page_and_source_unchanged(self):
  source=io.BytesIO();c=canvas.Canvas(source);c.drawString(50,100,'Original text');c.showPage();c.setPageSize((800,500));c.drawString(50,100,'Landscape');c.save()
  original=source.getvalue()
  result=stamp_pdf(io.BytesIO(original),SimpleNamespace(full_name='Test User',email='test@local',pk=17))
  pages=PdfReader(result).pages
  self.assertEqual(len(pages),2)
  for page in pages:self.assertIn('ID 17',page.extract_text());self.assertIn('Test User',page.extract_text())
  self.assertIn('Original text',pages[0].extract_text());self.assertEqual(float(pages[1].mediabox.width),800)
  self.assertEqual(source.getvalue(),original)
