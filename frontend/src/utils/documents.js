import DOMPurify from 'dompurify';

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename.replace(/[<>:"/\\|?*]/g, '_');
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printDocument(html, title) {
  const frame = document.createElement('iframe');
  frame.title = title; frame.style.cssText = 'position:fixed;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open(); doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:20mm}body{font-family:Arial;font-size:12pt}table{border-collapse:collapse;width:100%}td,th{border:1px solid #555;padding:6px}img{max-width:100%}</style></head><body>${DOMPurify.sanitize(html)}</body></html>`); doc.close();
  doc.title = title;
  frame.contentWindow.focus(); frame.contentWindow.print();
  setTimeout(() => frame.remove(), 60000);
}

export async function exportDocx(html) {
  const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType, UnderlineType } = await import('docx');
  const root = new DOMParser().parseFromString(DOMPurify.sanitize(html), 'text/html').body;
  function runs(node, inherited = {}) {
    if (node.nodeType === 3) return [new TextRun({ text: node.textContent, ...inherited })];
    if (node.nodeType !== 1) return [];
    if (node.tagName === 'BR') return [new TextRun({ break: 1 })];
    if (node.tagName === 'IMG') {
      const match = node.getAttribute('src')?.match(/^data:image\/(png|jpeg|jpg|gif|bmp);base64,(.+)$/s);
      if (!match) return [];
      const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
      return [new ImageRun({ type: match[1] === 'jpeg' ? 'jpg' : match[1], data: bytes, transformation: { width: Math.min(600, Number(node.getAttribute('width')) || 400), height: Math.min(800, Number(node.getAttribute('height')) || 240) } })];
    }
    const marks = { ...inherited };
    if (['B', 'STRONG'].includes(node.tagName)) marks.bold = true;
    if (['I', 'EM'].includes(node.tagName)) marks.italics = true;
    if (node.tagName === 'U') marks.underline = { type: UnderlineType.SINGLE };
    if (['S', 'STRIKE'].includes(node.tagName)) marks.strike = true;
    if (node.style.fontFamily) marks.font = node.style.fontFamily;
    if (node.style.fontSize) marks.size = Math.round(parseFloat(node.style.fontSize) * (node.style.fontSize.endsWith('px') ? 1.5 : 2));
    const color = node.style.color;
    if (color) { const rgb = color.match(/\d+/g); marks.color = color.startsWith('#') ? color.slice(1) : rgb?.slice(0, 3).map((v) => Number(v).toString(16).padStart(2, '0')).join(''); }
    return [...node.childNodes].flatMap((child) => runs(child, marks));
  }
  function blocks(parent) {
    return [...parent.children].flatMap((node) => {
      if (node.tagName === 'TABLE') return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [...node.rows].map((row) => new TableRow({ children: [...row.cells].map((cell) => new TableCell({ columnSpan: cell.colSpan || 1, rowSpan: cell.rowSpan || 1, children: blocks(cell).length ? blocks(cell) : [new Paragraph({ children: runs(cell) })] })) })) })];
      if (['UL', 'OL'].includes(node.tagName)) return [...node.children].map((li) => new Paragraph({ children: runs(li), ...(node.tagName === 'UL' ? { bullet: { level: 0 } } : { numbering: { reference: 'ordered', level: 0 } }) }));
      if (['DIV', 'SECTION', 'TBODY'].includes(node.tagName)) return blocks(node);
      return [new Paragraph({ children: runs(node), heading: { H1: HeadingLevel.HEADING_1, H2: HeadingLevel.HEADING_2, H3: HeadingLevel.HEADING_3 }[node.tagName], alignment: { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED }[node.style.textAlign], spacing: { after: 120 } })];
    });
  }
  return Packer.toBlob(new Document({ numbering: { config: [{ reference: 'ordered', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.LEFT }] }] }, sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } }, children: blocks(root) }] }));
}
