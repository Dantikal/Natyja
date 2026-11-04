import { useRef, useState, useEffect, useMemo } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import { HyperFormula } from 'hyperformula';
import { registerLanguageDictionary } from 'handsontable/i18n';
import ruRU from 'handsontable/i18n/languages/ru-RU';
import { phrases } from '../i18n/phrases';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import { useLang } from '../context/LanguageContext';
import { downloadBlob } from '../utils/documents';

registerAllModules();
registerLanguageDictionary(ruRU);
const kyrgyz = value => Array.isArray(value) ? value.map(kyrgyz) : phrases[value] || value;
registerLanguageDictionary({ ...Object.fromEntries(Object.entries(ruRU).map(([key, value]) => [key, kyrgyz(value)])), languageCode: 'ky-KG' });
const emptyData = () => Array.from({ length: 20 }, () => Array(8).fill(''));
const makeSheet = (name, data = emptyData()) => ({ id: `${Date.now()}-${Math.random()}`, name, data, styles: {}, merges: [], widths: [] });
export function normalizeWorkbook(value) {
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = null; } }
  if (Array.isArray(value)) return { version: 2, sheets: [makeSheet('Sheet1', value.length ? value : emptyData())], active: 0 };
  if (value?.sheets?.length) return { ...value, active: Math.min(value.active || 0, value.sheets.length - 1), sheets: value.sheets.map((s) => ({ styles: {}, merges: [], widths: [], ...s })) };
  return { version: 2, sheets: [makeSheet('Sheet1')], active: 0 };
}

export default function ExcelEditor({ value, onChange, readOnly = false, task = null }) {
  const { tr, lang } = useLang();
  const hotRef = useRef(null);
  const inputRef = useRef(null);
  const [book, setBook] = useState(() => normalizeWorkbook(value));
  const bookRef = useRef(book);
  const lastOutput = useRef(value);
  const engineCleanup = useRef(new Map());
  const [selected, setSelected] = useState([0, 0, 0, 0]);
  const [formula, setFormula] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const active = book.sheets[book.active];
  const initialData = useMemo(() => active.data.map((row) => [...row]), [active.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const formulaEngine = useMemo(() => {
    // Sheet identity intentionally rebuilds the engine when switching workbooks.
    void active.id;
    return HyperFormula.buildFromSheets(Object.fromEntries(bookRef.current.sheets.map((s) => [s.name, s.data])), { licenseKey: 'internal-use-in-handsontable' });
  }, [active.id]);
  useEffect(() => {
    const timers = engineCleanup.current;
    clearTimeout(timers.get(formulaEngine)); timers.delete(formulaEngine);
    return () => { timers.set(formulaEngine, setTimeout(() => { if (!formulaEngine.isDestroyed) formulaEngine.destroy(); timers.delete(formulaEngine); }, 0)); };
  }, [formulaEngine]);
  useEffect(() => {
    if (value === lastOutput.current || JSON.stringify(value) === JSON.stringify(lastOutput.current)) return;
    const next = normalizeWorkbook(value); lastOutput.current = value; bookRef.current = next; setBook(next);
  }, [value]);
  function update(next) {
    bookRef.current = next; lastOutput.current = next; setBook(next); onChange?.(next);
  }
  function capture() {
    const hot = hotRef.current?.hotInstance;
    if (!hot || readOnly) return bookRef.current;
    const current = bookRef.current;
    const sheet = { ...current.sheets[current.active], data: hot.getSourceData().map((row) => [...row]),
      merges: hot.getPlugin('mergeCells').mergedCellsCollection.mergedCells.map(({ row, col, rowspan, colspan }) => ({ row, col, rowspan, colspan })),
      widths: Array.from({ length: hot.countCols() }, (_, c) => hot.getColWidth(c)) };
    const next = { ...current, sheets: current.sheets.map((s, i) => i === current.active ? sheet : s) };
    update(next); return next;
  }
  function switchSheet(index) {
    const next = capture();
    update({ ...next, active: index }); setSelected([0, 0, 0, 0]); setFormula(String(next.sheets[index].data[0]?.[0] ?? ''));
  }
  function addSheet() {
    const next = capture(); let n = next.sheets.length + 1;
    const names = new Set(next.sheets.map((s) => s.name));
    while (names.has(`Sheet${n}`)) n++;
    update({ ...next, sheets: [...next.sheets, makeSheet(`Sheet${n}`)], active: next.sheets.length });
  }
  function renameSheet() {
    const name = window.prompt(tr('Название листа'), active.name)?.trim();
    if (!name || name === active.name) return;
    if (/[\\/?*:[\]]/.test(name) || name.length > 31 || book.sheets.some((s) => s.name.toLowerCase() === name.toLowerCase())) { setError(tr('Название листа') + ': 1–31, без / \\ ? * [ ] :'); return; }
    // Renaming in the engine updates dependent formulas on every sheet.
    formulaEngine.renameSheet(formulaEngine.getSheetId(active.name), name);
    const sheets = bookRef.current.sheets.map((s, i) => ({ ...s, name: i === book.active ? name : s.name, data: formulaEngine.getSheetSerialized(formulaEngine.getSheetId(i === book.active ? name : s.name)) }));
    update({ ...bookRef.current, sheets });
  }
  function styleSelection(patch) {
    const current = capture(); const sheet = current.sheets[current.active]; const styles = { ...sheet.styles };
    const [r1, c1, r2, c2] = selected;
    for (let r = Math.max(0, Math.min(r1, r2)); r <= Math.max(r1, r2); r++) for (let c = Math.max(0, Math.min(c1, c2)); c <= Math.max(c1, c2); c++) styles[`${r}:${c}`] = { ...styles[`${r}:${c}`], ...patch };
    update({ ...current, sheets: current.sheets.map((s, i) => i === current.active ? { ...sheet, styles } : s) });
    hotRef.current.hotInstance.render();
  }
  const button = (label, action, disabled = false) => <button type="button" className="editor-button" key={label} disabled={disabled || busy} onClick={action}>{tr(label)}</button>;
  function alter(action) {
    const hot = hotRef.current.hotInstance;
    const [r, c] = selected;
    hot.alter(action, Math.max(0, action.includes('row') ? r : c), 1); capture();
  }
  function structure(axis, index, amount, removing) {
    if (readOnly || !hotRef.current?.hotInstance) return;
    const current = bookRef.current; const sheet = current.sheets[current.active]; const styles = {};
    Object.entries(sheet.styles).forEach(([key, style]) => {
      const coords = key.split(':').map(Number); const pos = coords[axis];
      if (removing && pos >= index && pos < index + amount) return;
      if (pos >= index) coords[axis] += removing ? -amount : amount;
      styles[coords.join(':')] = style;
    });
    bookRef.current = { ...current, sheets: current.sheets.map((s, i) => i === current.active ? { ...s, styles } : s) };
    capture();
  }
  function template(kind) {
    if (active.data.some((row) => row.some((v) => v !== '' && v != null)) && !window.confirm(tr('Текущий документ будет заменён. Продолжить?'))) return;
    const ky = lang === 'ky';
    const data = kind === 'report' ? [[ky ? 'АТКАРУУ ЖӨНҮНДӨ ОТЧЁТ' : 'ОТЧЁТ О ВЫПОЛНЕНИИ'], [ky ? 'Тапшырма' : 'Задача', task?.title || ''], [ky ? 'Аткаруучу' : 'Исполнитель', task?.soldier_name || ''], [], ['№', ky ? 'Иштин аталышы' : 'Наименование работы', ky ? 'Саны' : 'Кол-во', ky ? 'Бирдиги' : 'Ед. изм.', ky ? 'Абалы' : 'Статус'], [1, '', 0], [2, '', 0], [3, '', 0], [ky ? 'ЖАЛПЫ' : 'ИТОГО', '', '=SUM(C6:C8)']]
      : kind === 'time' ? [[ky ? 'ЖУМУШ УБАКТЫСЫНЫН ТАБЕЛИ' : 'ТАБЕЛЬ УЧЁТА РАБОЧЕГО ВРЕМЕНИ'], [ky ? 'Аткаруучу' : 'Исполнитель', task?.soldier_name || ''], [], [ky ? 'Күнү' : 'Дата', ky ? 'Аптанын күнү' : 'День недели', ky ? 'Саат' : 'Часы', ky ? 'Тапшырма' : 'Задача', ky ? 'Эскертүү' : 'Примечание'], ...[1, 2, 3, 4, 5, 6, 7].map((n) => ['', n, 0, '', '']), [ky ? 'Жалпы саат' : 'Всего часов', '', '=SUM(C5:C11)']]
      : [['№', ky ? 'Тапшырма' : 'Задача', ky ? 'Маанилүүлүгү' : 'Приоритет', ky ? 'Мөөнөтү' : 'Срок', ky ? 'Абалы' : 'Статус'], ...[1, 2, 3, 4, 5].map((n) => [n, '', '', '', ''])];
    hotRef.current.hotInstance.loadData(data); capture();
  }
  async function openFile(event) {
    const file = event.target.files?.[0]; if (!file) return;
    setBusy(true); setError('');
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error(tr('Файл не должен превышать 10 МБ'));
      // Choosing a file through the explicit Open action replaces this workbook.
      let sheets;
      if (/\.csv$/i.test(file.name)) sheets = [makeSheet('Sheet1', parseCsv(await file.text()))];
      else {
        const { Workbook } = await import('exceljs'); const workbook = new Workbook();
        await workbook.xlsx.load(await file.arrayBuffer());
        sheets = workbook.worksheets.map((ws) => {
          if (ws.rowCount > 10000 || ws.columnCount > 500) throw new Error('XLSX: 10000 × 500');
          const data = []; const styles = {};
          ws.eachRow({ includeEmpty: true }, (row, r) => {
            data[r - 1] = Array.from({ length: Math.max(ws.columnCount, 1) }, (_, c) => {
              const cell = row.getCell(c + 1); const v = cell.value;
              styles[`${r - 1}:${c}`] = { bold: Boolean(cell.font?.bold), italic: Boolean(cell.font?.italic), color: cell.font?.color?.argb ? '#' + cell.font.color.argb.slice(-6) : undefined, background: cell.fill?.fgColor?.argb ? '#' + cell.fill.fgColor.argb.slice(-6) : undefined, format: cell.numFmt, align: cell.alignment?.horizontal };
              if (v instanceof Date) return v.toISOString().slice(0, 10);
              return v?.formula ? `=${v.formula}` : v?.sharedFormula ? `=${cell.formula}` : v?.richText ? v.richText.map((t) => t.text).join('') : v?.text ?? v?.result ?? v ?? '';
            });
          });
          return { ...makeSheet(ws.name, data.length ? data : emptyData()), styles, merges: (ws.model.merges || []).map((range) => { const [start, end] = range.split(':').map(cellAddress); return { row: start[0], col: start[1], rowspan: end[0] - start[0] + 1, colspan: end[1] - start[1] + 1 }; }), widths: (ws.columns || []).map((c) => Math.round((c.width || 12) * 7)) };
        });
      }
      update({ version: 2, sheets: sheets.length ? sheets : [makeSheet('Sheet1')], active: 0 });
    } catch (err) { setError(`${tr('Не удалось открыть файл')}: ${err.message}`); }
    finally { setBusy(false); event.target.value = ''; }
  }
  async function exportFile() {
    setBusy(true); setError('');
    try {
      const current = capture(); const { Workbook } = await import('exceljs'); const workbook = new Workbook();
      current.sheets.forEach((sheet) => {
        const ws = workbook.addWorksheet(sheet.name);
        sheet.data.forEach((row, r) => row.forEach((v, c) => {
          const cell = ws.getCell(r + 1, c + 1);
          cell.value = typeof v === 'string' && v.startsWith('=') ? { formula: v.slice(1) } : v;
          const style = sheet.styles[`${r}:${c}`] || {};
          cell.font = { name: 'Calibri', size: 11, bold: style.bold, italic: style.italic, ...(style.color ? { color: { argb: 'FF' + style.color.slice(1) } } : {}) };
          if (style.background) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + style.background.slice(1) } };
          if (style.format) cell.numFmt = style.format;
          if (style.align) cell.alignment = { horizontal: style.align };
        }));
        sheet.merges.forEach((m) => ws.mergeCells(m.row + 1, m.col + 1, m.row + m.rowspan, m.col + m.colspan));
        sheet.widths.forEach((w, i) => { ws.getColumn(i + 1).width = Math.max(4, w / 7); });
      });
      workbook.calcProperties.fullCalcOnLoad = true;
      downloadBlob(new Blob([await workbook.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${task?.title || 'report'}.xlsx`);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <div className="excel-editor-wrap office-editor">
    <div className="office-filebar">
      {!readOnly && button('Открыть XLSX / CSV', () => inputRef.current.click())}{button('Скачать XLSX', exportFile)}
      {!readOnly && task && <>{button('Отчёт о выполнении', () => template('report'))}{button('Табель', () => template('time'))}{button('Список работ', () => template('list'))}</>}
      <input hidden ref={inputRef} type="file" accept=".xlsx,.csv" onChange={openFile} />
    </div>
    {!readOnly && <div className="editor-tools office-toolbar">
      {button('Отменить', () => { hotRef.current.hotInstance.undo(); capture(); })}{button('Повторить', () => { hotRef.current.hotInstance.redo(); capture(); })}
      {button('+ Строка', () => alter('insert_row_below'))}{button('+ Столбец', () => alter('insert_col_end'))}
      {button('Удалить строку', () => alter('remove_row'))}{button('Удалить столбец', () => alter('remove_col'))}
      {button('Жирный', () => styleSelection({ bold: !active.styles[`${selected[0]}:${selected[1]}`]?.bold }))}
      {button('Курсив', () => styleSelection({ italic: !active.styles[`${selected[0]}:${selected[1]}`]?.italic }))}
      <select aria-label={tr('Число')} onChange={(e) => styleSelection({ format: e.target.value })} value={active.styles[`${selected[0]}:${selected[1]}`]?.format || 'General'}>
        <option value="General">{tr('Текст')}</option><option value="0.00">{tr('Число')}</option><option value="0.00%">{tr('Процент')}</option><option value="#,##0.00">{tr('Денежный')}</option>
      </select>
      <label className="editor-color">A <input type="color" aria-label={tr('Цвет текста')} onChange={(e) => styleSelection({ color: e.target.value })} /></label>
      <label className="editor-color">▣ <input type="color" aria-label={tr('Цвет фона')} onChange={(e) => styleSelection({ background: e.target.value })} /></label>
      {button('Объединить ячейки', () => { hotRef.current.hotInstance.getPlugin('mergeCells').mergeSelection(); capture(); })}
      {button('Разделить ячейку', () => { hotRef.current.hotInstance.getPlugin('mergeCells').unmergeSelection(); capture(); })}
    </div>}
    <div className="formula-bar"><span>{columnName(Math.max(0, selected[1]))}{Math.max(0, selected[0]) + 1}</span><b>fx</b><input aria-label={tr('Формула / значение')} value={formula} readOnly={readOnly} onChange={(e) => setFormula(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !readOnly) { e.preventDefault(); hotRef.current.hotInstance.setDataAtCell(Math.max(0, selected[0]), Math.max(0, selected[1]), formula); } }} />
      {!readOnly && button('Вставить', () => hotRef.current.hotInstance.setDataAtCell(Math.max(0, selected[0]), Math.max(0, selected[1]), formula))}</div>
    {error && <div className="error-msg" role="alert">{error}</div>}
    <div className="spreadsheet-viewport"><HotTable key={active.id} ref={hotRef} data={initialData} rowHeaders colHeaders width="100%" height={430} licenseKey="non-commercial-and-evaluation" readOnly={readOnly} themeName="ht-theme-main"
      language={lang === 'ky' ? 'ky-KG' : 'ru-RU'} formulas={{ engine: formulaEngine, sheetName: active.name }} contextMenu={readOnly ? false : ['row_above', 'row_below', 'col_left', 'col_right', '---------', 'remove_row', 'remove_col', '---------', 'undo', 'redo', '---------', 'mergeCells', 'copy', 'cut']} dropdownMenu={!readOnly} filters columnSorting undo={!readOnly} copyPaste
      manualColumnResize={!readOnly} manualRowResize={!readOnly} mergeCells={active.merges} colWidths={active.widths.length ? active.widths : 110} minRows={20} minCols={8} stretchH="none"
      cells={(row, col) => { const style = bookRef.current.sheets[bookRef.current.active].styles[`${row}:${col}`] || {}; return { renderer: (instance, td, r, c, prop, v) => {
        td.textContent = v == null ? '' : typeof v === 'number' && style.format === '0.00%' ? `${(v * 100).toFixed(2)}%` : typeof v === 'number' && ['0.00', '#,##0.00'].includes(style.format) ? v.toLocaleString(lang === 'ky' ? 'ky-KG' : 'ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(v);
        td.style.fontWeight = style.bold ? '700' : ''; td.style.fontStyle = style.italic ? 'italic' : ''; td.style.color = style.color || ''; td.style.backgroundColor = style.background || ''; td.style.textAlign = style.align || (typeof v === 'number' ? 'right' : 'left');
      } }; }}
      afterSelectionEnd={(r, c, r2, c2) => { setSelected([r, c, r2, c2]); setFormula(String(hotRef.current?.hotInstance.getSourceDataAtCell(Math.max(0, r), Math.max(0, c)) ?? '')); }}
      afterChange={(changes, source) => { if (source !== 'loadData' && changes && !readOnly) { capture(); setFormula(String(hotRef.current.hotInstance.getSourceDataAtCell(Math.max(0, selected[0]), Math.max(0, selected[1])) ?? '')); } }}
      afterCreateRow={(index, amount) => structure(0, index, amount, false)} afterCreateCol={(index, amount) => structure(1, index, amount, false)} afterRemoveRow={(index, amount) => structure(0, index, amount, true)} afterRemoveCol={(index, amount) => structure(1, index, amount, true)} afterMergeCells={() => !readOnly && capture()} afterUnmergeCells={() => !readOnly && capture()} afterColumnResize={() => !readOnly && capture()}
    /></div>
    <div className="sheet-tabs" role="tablist">{book.sheets.map((sheet, index) => <button type="button" role="tab" aria-selected={index === book.active} className={index === book.active ? 'active' : ''} key={sheet.id} onClick={() => switchSheet(index)}>{sheet.name}</button>)}
      {!readOnly && <>{button('+ Лист', addSheet)}{button('Переименовать лист', renameSheet)}{button('Удалить лист', () => { if (window.confirm(tr('Текущий документ будет заменён. Продолжить?'))) update({ ...book, sheets: book.sheets.filter((_, i) => i !== book.active), active: 0 }); }, book.sheets.length <= 1)}</>}
    </div><div className="office-status">SUM · AVERAGE · IF · COUNT · MIN · MAX · XLSX</div>
  </div>;
}
function columnName(col) { let result = ''; for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result; return result; }
function cellAddress(address) { const [, letters, row] = address.match(/([A-Z]+)(\d+)/); return [Number(row) - 1, [...letters].reduce((sum, c) => sum * 26 + c.charCodeAt(0) - 64, 0) - 1]; }
function parseCsv(text) {
  text = text.replace(/^\uFEFF/, ''); const delimiter = text.split(/\r?\n/)[0].includes(';') ? ';' : ',';
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) { const c = text[i]; if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; } else if (!quoted && c === delimiter) { row.push(cell); cell = ''; } else if (!quoted && (c === '\n' || c === '\r')) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += c; }
  if (cell || row.length) { row.push(cell); rows.push(row); } return rows.length ? rows : emptyData();
}
