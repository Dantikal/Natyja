import { useState } from 'react';
import api from '../api/axios';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { WordEditor, ExcelEditor } from './DeferredEditors';
import FileUpload from './FileUpload';
import TaskAttachment from './TaskAttachment';
export default function ReportEditorModal({
  task,
  onClose,
  onSaved
}) {
  const {
    tr,
    lang
  } = useLang();
  const [uploadedFile, setUploadedFile] = useState(task.report_file);
  const [dirty, setDirty] = useState(false);
  function close() { if (!dirty || window.confirm(tr('Сохраните отчёт перед закрытием. Закрыть без сохранения?'))) onClose(); }
  const [reportType, setReportType] = useState(task.report_type || "text");
  const [reportHtml, setReportHtml] = useState(task.report_html || "");
  const [reportTable, setReportTable] = useState(task.report_table_json || null);
  const [reportNote, setReportNote] = useState(task.report_note || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();
  const toAdmin = user?.role === 'commander';
  async function handleSave(submit = false) {
    const table = typeof reportTable === 'string' ? JSON.parse(reportTable) : reportTable;
    const rows = Array.isArray(table) ? table : table?.sheets?.flatMap(s => s.data) || [];
    const hasText = reportHtml.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (!uploadedFile && (reportType === 'text' ? !hasText : !rows.some(row => row.some(cell => cell !== '' && cell != null)))) { setError(tr('Отчёт пуст')); return; }
    setSaving(true);
    setError("");
    try {
      await api.patch(`/tasks/${task.id}/report`, {
        reportType,
        reportHtml,
        reportTable,
        reportNote
      });
      if (submit) await api.patch(`/tasks/${task.id}/submit`);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || tr("Ошибка"));
    } finally {
      setSaving(false);
    }
  }
  return <div className="form-overlay">
      <div className="soldier-form report-editor-modal" role="dialog" aria-modal="true" aria-label={tr('Отчёт по задаче')} style={{
      maxWidth: 900
    }}>
        <div className="report-dialog-heading"><h2>{tr("Отчёт по задаче")}</h2><button type="button" className="btn-secondary" onClick={close} disabled={saving}>{tr('Закрыть')}</button></div>
        <p className="report-recipient">{tr(toAdmin ? 'Отчёт будет направлен администратору' : 'Отчёт будет направлен командиру')}</p>
        <TaskAttachment task={task} />
        <p style={{
        color: "var(--muted)",
        fontSize: 13,
        marginBottom: 16
      }}>
          <b>{task.title}</b>{tr("· До:")}{new Date(task.due_date).toLocaleDateString(lang === "ky" ? "ky-KG" : "ru-RU")}
        </p>

        <div className="report-tabs">
          <button type="button" className={reportType === "text" ? "active" : ""} onClick={() => setReportType("text")}>{tr("Текстовый отчёт (Word)")}</button>
          <button type="button" className={reportType === "table" ? "active" : ""} onClick={() => setReportType("table")}>{tr("Таблица данных (Excel)")}</button>
        </div>
                {/* Блок загрузки файла */}
        <details className="report-attachment" style={{
        marginTop: 20
      }}>
          <summary className="report-section-label">{tr("Или прикрепите готовый файл (Word / Excel / PDF / Фото):")}</summary>
          <FileUpload taskId={task.id} currentFile={uploadedFile} currentType={task.report_file_type} onUploaded={({ filename }) => setUploadedFile(filename)} />
        </details>

        {reportType === "text" ? <WordEditor value={reportHtml} onChange={v => { setReportHtml(v); setDirty(true); }} task={task} /> : <ExcelEditor value={reportTable} onChange={v => { setReportTable(v); setDirty(true); }} task={task} />}

        <label style={{
        display: "block",
        marginTop: 16
      }}>{tr("Текстовый комментарий")}<textarea rows="3" value={reportNote} onChange={e => setReportNote(e.target.value)} style={{
          width: "100%",
          marginTop: 6,
          padding: "10px 12px",
          border: "1.5px solid #cbd5e1",
          borderRadius: 6,
          fontSize: 14,
          fontFamily: "inherit"
        }} />
        </label>

        {error && <div className="error-msg">{error}</div>}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={close}>{tr("Отмена")}</button>
          <button type="button" className="btn-secondary" onClick={() => handleSave(false)} disabled={saving}>
            {saving ? tr("Сохранение...") : tr("Сохранить отчёт")}
          </button>
          <button type="button" className="btn-primary" onClick={() => handleSave(true)} disabled={saving}>{tr(saving ? 'Сохранение...' : toAdmin ? 'Отправить администратору' : 'Отправить командиру')}</button>
        </div>
      </div>
    </div>;
}



