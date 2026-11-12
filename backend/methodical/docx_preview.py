import html
import io
from xml.etree import ElementTree
import zipfile


WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W = f"{{{WORD_NAMESPACE}}}"
MAX_DOCUMENT_XML_SIZE = 10 * 1024 * 1024


class DocxPreviewError(ValueError):
    pass


def _run_html(run):
    parts = []
    for node in run.iter():
        if node.tag == f"{W}t":
            parts.append(html.escape(node.text or ""))
        elif node.tag == f"{W}tab":
            parts.append("&emsp;")
        elif node.tag in {f"{W}br", f"{W}cr"}:
            parts.append("<br>")

    value = "".join(parts)
    properties = run.find(f"{W}rPr")
    if properties is not None:
        if properties.find(f"{W}b") is not None:
            value = f"<strong>{value}</strong>"
        if properties.find(f"{W}i") is not None:
            value = f"<em>{value}</em>"
        if properties.find(f"{W}u") is not None:
            value = f"<u>{value}</u>"
    return value


def _paragraph_html(paragraph):
    content = "".join(
        _run_html(run) for run in paragraph.iter(f"{W}r")
    )
    properties = paragraph.find(f"{W}pPr")
    style = ""
    numbered = False
    if properties is not None:
        style_node = properties.find(f"{W}pStyle")
        style = style_node.get(f"{W}val", "") if style_node is not None else ""
        numbered = properties.find(f"{W}numPr") is not None

    normalized_style = style.lower()
    if normalized_style.startswith("heading"):
        suffix = normalized_style.removeprefix("heading")
        level = int(suffix) if suffix.isdigit() else 2
        level = min(max(level, 1), 6)
        return f"<h{level}>{content}</h{level}>"
    if numbered:
        return f'<p class="docx-list-item">{content or "&nbsp;"}</p>'
    return f"<p>{content or '&nbsp;'}</p>"


def _table_html(table):
    rows = []
    for row in table.findall(f"{W}tr"):
        cells = []
        for cell in row.findall(f"{W}tc"):
            cell_content = "".join(
                _paragraph_html(paragraph)
                for paragraph in cell.findall(f"{W}p")
            )
            cells.append(f"<td>{cell_content}</td>")
        rows.append(f"<tr>{''.join(cells)}</tr>")
    return f"<table><tbody>{''.join(rows)}</tbody></table>"


def extract_docx_preview(uploaded_file):
    uploaded_file.seek(0)
    payload = uploaded_file.read()
    uploaded_file.seek(0)

    try:
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            try:
                document_info = archive.getinfo("word/document.xml")
            except KeyError as error:
                raise DocxPreviewError("Файл не является корректным документом DOCX.") from error
            if document_info.file_size > MAX_DOCUMENT_XML_SIZE:
                raise DocxPreviewError("Содержимое документа слишком большое.")
            document_xml = archive.read(document_info)
    except (zipfile.BadZipFile, RuntimeError) as error:
        raise DocxPreviewError("Файл не является корректным документом DOCX.") from error

    try:
        root = ElementTree.fromstring(document_xml)
    except ElementTree.ParseError as error:
        raise DocxPreviewError("Не удалось прочитать содержимое документа.") from error

    body = root.find(f"{W}body")
    if body is None:
        raise DocxPreviewError("В документе не найдено содержимое.")

    preview = []
    for node in body:
        if node.tag == f"{W}p":
            preview.append(_paragraph_html(node))
        elif node.tag == f"{W}tbl":
            preview.append(_table_html(node))
    return "".join(preview)
