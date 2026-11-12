import io
from pathlib import Path
from django.utils import timezone
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


def stamp_pdf(source, user):
    font='Helvetica'
    for path in [Path('C:/Windows/Fonts/arial.ttf'),Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')]:
        if path.exists():
            if 'WatermarkFont' not in pdfmetrics.getRegisteredFontNames():pdfmetrics.registerFont(TTFont('WatermarkFont',str(path)))
            font='WatermarkFont';break
    label=f'{user.full_name or user.email} · ID {user.pk} · {timezone.localtime():%Y-%m-%d %H:%M:%S %z}'
    reader=PdfReader(source);writer=PdfWriter()
    if reader.is_encrypted: raise ValueError('Password protected PDF')
    writer.append(reader)
    for page in writer.pages:
        page.transfer_rotation_to_content()
        width,height=float(page.mediabox.width),float(page.mediabox.height)
        overlay=io.BytesIO();c=canvas.Canvas(overlay,pagesize=(width,height));c.setFillColorRGB(.25,.3,.28);c.setFillAlpha(.16);c.setFont(font,11)
        for y in range(90,int(height),160):
            c.saveState();c.translate(width/2,y);c.rotate(25);c.drawCentredString(0,0,'КҮЖҮРМӨН АСКЕР · '+label);c.restoreState()
        c.setFillAlpha(.7);c.setFont(font,7);c.drawCentredString(width/2,16,label);c.save()
        page.merge_page(PdfReader(overlay).pages[0])
    result=io.BytesIO();writer.write(result);result.seek(0);return result
