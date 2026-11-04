import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import DOMPurify from 'dompurify';
import { useLang } from '../context/LanguageContext';
import { downloadBlob, exportDocx, printDocument } from '../utils/documents';

const safe = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default function WordEditor({ value, onChange, readOnly = false, task = null }) {
  const { tr, lang } = useLang();
  const fileRef = useRef(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const editor = useEditor({
    extensions: [StarterKit, TableKit.configure({ table: { resizable: true } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }), TextStyleKit, Image.configure({ allowBase64: true }),
      Placeholder.configure({ placeholder: tr('Начните печатать отчёт...') })],
    content: DOMPurify.sanitize(value || ''), editable: !readOnly,
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor: current }) => onChange?.(current.getHTML()),
    editorProps: { attributes: { class: 'document-page', 'aria-label': tr('Документ'), spellcheck: 'true' } },
  });
  useEffect(() => { if (editor && !editor.isDestroyed && editor.schema) editor.setEditable(!readOnly); }, [editor, readOnly]);
  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.schema && DOMPurify.sanitize(value || '') !== editor.getHTML()) {
      if (!value && editor.isEmpty) return;
      editor.commands.setContent(DOMPurify.sanitize(value || ''), { emitUpdate: false });
    }
  }, [editor, value]);
  if (!editor || editor.isDestroyed || !editor.schema) return null;
  const command = (label, action, active = false, disabled = false) => (
    <button type="button" key={label} title={tr(label)} aria-label={tr(label)} aria-pressed={active}
      disabled={disabled || busy} className={`editor-button ${active ? 'is-active' : ''}`}
      onMouseDown={(event) => event.preventDefault()} onClick={action}>{tr(label)}</button>
  );
  function replace(html) {
    if (!editor.isEmpty && !window.confirm(tr('Текущий документ будет заменён. Продолжить?'))) return;
    editor.commands.setContent(DOMPurify.sanitize(html));
  }
  function template(structured) {
    const ky = lang === 'ky';
    replace(`<h1 style="text-align:center">${ky ? 'ТАПШЫРМА БОЮНЧА ОТЧЁТ' : 'ОТЧЁТ О ВЫПОЛНЕНИИ ЗАДАЧИ'}</h1>
      <p><strong>${ky ? 'Тапшырма' : 'Задача'}:</strong> ${safe(task?.title)}</p>
      <p><strong>${ky ? 'Аткаруучу' : 'Исполнитель'}:</strong> ${safe(task?.soldier_name || '—')}</p>
      <p><strong>${ky ? 'Мөөнөтү' : 'Срок'}:</strong> ${task?.due_date ? new Date(task.due_date).toLocaleDateString(ky ? 'ky-KG' : 'ru-RU') : '—'}</p>
      ${structured ? `<table><tbody><tr><th>№</th><th>${ky ? 'Аткарылган иштер' : 'Что сделано'}</th><th>${ky ? 'Жыйынтык' : 'Результат'}</th></tr><tr><td>1</td><td><p></p></td><td><p></p></td></tr><tr><td>2</td><td><p></p></td><td><p></p></td></tr></tbody></table>` : `<h2>${ky ? 'Аткарылган иштер' : 'Что сделано'}</h2><p></p><h2>${ky ? 'Жыйынтык' : 'Результат'}</h2><p></p>`}`);
  }
  async function openFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setError('');
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error(tr('Файл не должен превышать 10 МБ'));
      const mammoth = await import('mammoth/mammoth.browser');
      const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
      replace(result.value);
    } catch (err) { setError(`${tr('Не удалось открыть файл')}: ${err.message}`); }
    finally { setBusy(false); event.target.value = ''; }
  }
  async function saveFile() {
    setBusy(true); setError('');
    try { downloadBlob(await exportDocx(editor.getHTML()), `${task?.title || 'report'}.docx`); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <div className={`word-editor-wrap office-editor ${readOnly ? 'readonly' : ''}`}>
    <div className="office-filebar">
      {!readOnly && command('Открыть DOCX', () => fileRef.current.click())}
      {command('Скачать DOCX', saveFile)}
      {command('Печать / PDF', () => printDocument(editor.getHTML(), task?.title || tr('Документ')))}
      {!readOnly && task && <><span className="editor-divider" />{command('Универсальный', () => template(false))}{command('Структурированный', () => template(true))}</>}
      <input ref={fileRef} hidden type="file" accept=".docx" onChange={openFile} />
    </div>
    {!readOnly && <div className="office-toolbar" role="toolbar" aria-label="Word">
      <div className="editor-tools">
        {command('Отменить', () => editor.chain().focus().undo().run(), false, !editor.can().undo())}
        {command('Повторить', () => editor.chain().focus().redo().run(), false, !editor.can().redo())}
        <select aria-label={tr('Обычный текст')} value={[1, 2, 3].find((level) => editor.isActive('heading', { level })) || 0}
          onChange={(e) => Number(e.target.value) ? editor.chain().focus().setHeading({ level: Number(e.target.value) }).run() : editor.chain().focus().setParagraph().run()}>
          <option value="0">{tr('Обычный текст')}</option>{[1, 2, 3].map((n) => <option key={n} value={n}>{tr(`Заголовок ${n}`)}</option>)}
        </select>
        <select aria-label={tr('Шрифт')} value={editor.getAttributes('textStyle').fontFamily || 'Arial'} onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}>
          {['Arial', 'Times New Roman', 'Calibri', 'Georgia', 'Courier New'].map((font) => <option key={font}>{font}</option>)}
        </select>
        <select aria-label={tr('Размер')} value={editor.getAttributes('textStyle').fontSize || '12pt'} onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}>
          {[8, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36].map((n) => <option key={n} value={`${n}pt`}>{n}</option>)}
        </select>
      </div>
      <div className="editor-tools">
        {[['Жирный', 'bold', 'toggleBold'], ['Курсив', 'italic', 'toggleItalic'], ['Подчёркнутый', 'underline', 'toggleUnderline'], ['Зачёркнутый', 'strike', 'toggleStrike']].map(([label, name, method]) => command(label, () => editor.chain().focus()[method]().run(), editor.isActive(name)))}
        <label className="editor-color" title={tr('Цвет текста')}>A <input type="color" aria-label={tr('Цвет текста')} value={editor.getAttributes('textStyle').color || '#172b45'} onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} /></label>
        <label className="editor-color" title={tr('Цвет фона')}>▣ <input type="color" aria-label={tr('Цвет фона')} value={editor.getAttributes('textStyle').backgroundColor || '#ffffff'} onChange={(e) => editor.chain().focus().setBackgroundColor(e.target.value).run()} /></label>
        {['left', 'center', 'right', 'justify'].map((align, index) => command(['Слева', 'По центру', 'Справа', 'По ширине'][index], () => editor.chain().focus().setTextAlign(align).run(), editor.isActive({ textAlign: align })))}
        {command('Маркированный список', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
        {command('Нумерованный список', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
        {command('Очистить формат', () => editor.chain().focus().unsetAllMarks().clearNodes().run())}
      </div>
      <div className="editor-tools">
        {command('Таблица', () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
        {editor.isActive('table') && [['+ Строка', 'addRowAfter'], ['+ Столбец', 'addColumnAfter'], ['Удалить строку', 'deleteRow'], ['Удалить столбец', 'deleteColumn'], ['Объединить ячейки', 'mergeCells'], ['Разделить ячейку', 'splitCell'], ['Удалить таблицу', 'deleteTable']].map(([label, method]) => command(label, () => editor.chain().focus()[method]().run()))}
      </div>
    </div>}
    {error && <div className="error-msg" role="alert">{error}</div>}
    <div className="document-workspace"><EditorContent editor={editor} /></div>
    <div className="office-status">{tr('Слов')}: {editor.getText().trim().split(/\s+/).filter(Boolean).length} · DOCX</div>
  </div>;
}
