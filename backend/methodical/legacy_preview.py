"""Create a cached viewing copy; never modify the uploaded Word document."""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
from django.conf import settings

_conversion_lock = threading.Lock()
class LegacyPreviewError(Exception):
    pass

def legacy_word_preview(field):
    source = Path(field.path)
    if source.stat().st_size > 50 * 1024 * 1024:
        raise LegacyPreviewError("Файл слишком большой для просмотра (максимум 50 МБ).")
    digest = hashlib.sha256()
    with source.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    cache = Path(settings.BASE_DIR) / ".document-previews"
    cache.mkdir(exist_ok=True)
    result = cache / (digest.hexdigest() + ".docx")
    with _conversion_lock:
        if result.is_file():
            return result
        try:
            with tempfile.TemporaryDirectory(prefix="word-preview-") as temporary:
                folder = Path(temporary)
                local_source = folder / "source.doc"
                shutil.copyfile(source, local_source)
                output = folder / "preview.docx"
                if os.name == "nt":
                    script = Path(__file__).with_name("convert_word_preview.ps1")
                    command = ["powershell.exe", "-NoProfile", "-NonInteractive", "-File", str(script), "-SourcePath", str(local_source), "-OutputPath", str(output)]
                else:
                    executable = shutil.which("libreoffice") or shutil.which("soffice")
                    if not executable:
                        raise LegacyPreviewError("На сервере не настроено преобразование документов Word.")
                    command = [executable, "--headless", f"-env:UserInstallation={ (folder / 'profile').as_uri() }", "--convert-to", "docx", "--outdir", str(folder), str(local_source)]
                    output = folder / "source.docx"
                completed = subprocess.run(command, capture_output=True, timeout=90, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
                if completed.returncode or not output.is_file():
                    raise LegacyPreviewError("Не удалось прочитать документ Word. Файл может быть повреждён. Откройте исходник в Word и загрузите исправную копию в формате DOCX.")
                shutil.copyfile(output, result)
        except subprocess.TimeoutExpired as error:
            raise LegacyPreviewError("Подготовка просмотра заняла слишком много времени. Попробуйте ещё раз.") from error
    return result


OFFICE_PREVIEW_EXTENSIONS = {'.xls', '.xlsx', '.ods', '.csv', '.ppt', '.pptx', '.odp', '.odt', '.rtf'}

def office_pdf_preview(field):
    source = Path(field.path)
    if source.stat().st_size > 50 * 1024 * 1024:
        raise LegacyPreviewError('Файл слишком большой для просмотра (максимум 50 МБ).')
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    cache = Path(settings.BASE_DIR) / '.document-previews'
    cache.mkdir(exist_ok=True)
    result = cache / (digest + '.pdf')
    with _conversion_lock:
        if result.is_file():
            return result
        try:
            with tempfile.TemporaryDirectory(prefix='office-preview-') as temporary:
                folder = Path(temporary)
                local = folder / ('source' + source.suffix.lower())
                shutil.copyfile(source, local)
                output = folder / 'preview.pdf'
                if os.name == 'nt':
                    command = ['powershell.exe', '-NoProfile', '-NonInteractive', '-File', str(Path(__file__).with_name('convert_office_preview.ps1')), '-SourcePath', str(local), '-OutputPath', str(output)]
                else:
                    executable = shutil.which('libreoffice') or shutil.which('soffice')
                    if not executable:
                        raise LegacyPreviewError('На сервере не настроено преобразование Office.')
                    command = [executable, '--headless', f'-env:UserInstallation={(folder / "profile").as_uri()}', '--convert-to', 'pdf', '--outdir', str(folder), str(local)]
                    output = folder / 'source.pdf'
                completed = subprocess.run(command, capture_output=True, timeout=90, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
                if completed.returncode or not output.is_file():
                    raise LegacyPreviewError('Не удалось подготовить просмотр. Возможно, файл повреждён или защищён паролем.')
                shutil.copyfile(output, result)
        except subprocess.TimeoutExpired as error:
            raise LegacyPreviewError('Подготовка просмотра заняла слишком много времени.') from error
    return result
