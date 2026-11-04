import { useState } from 'react';
import api from '../api/axios';
import { useLang } from '../context/LanguageContext';
import { downloadBlob } from '../utils/documents';

export function DownloadFile({ taskId, filename, kind = 'report' }) {
  const { tr } = useLang(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function download() {
    setBusy(true); setError('');
    try { const response = await api.get(`/tasks/${taskId}/${kind === 'task' ? 'attachment' : 'download'}`, { responseType: 'blob' }); downloadBlob(response.data, filename || 'report'); }
    catch { setError(tr('Ошибка загрузки')); } finally { setBusy(false); }
  }
  return <><button type="button" className="btn-small download-link" disabled={busy} onClick={download}>{tr(busy ? 'Загрузка...' : 'Скачать файл')}</button>{error && <span className="error-msg" role="alert">{error}</span>}</>;
}
export default function FileUpload({ taskId, currentFile, currentType, onUploaded, readOnly = false }) {
  const { tr } = useLang(); const [uploading, setUploading] = useState(false); const [error, setError] = useState('');
  async function upload(event) {
    const input = event.target; const file = input.files?.[0]; if (!file) return;
    setError('');
    if (file.size > 10 * 1024 * 1024) { setError(tr('Файл не должен превышать 10 МБ')); input.value = ''; return; }
    setUploading(true);
    try { const form = new FormData(); form.append('file', file); await api.post(`/tasks/${taskId}/upload-file`, form, { headers: { 'Content-Type': 'multipart/form-data' } }); onUploaded?.({ filename: file.name }); }
    catch (err) { setError(tr(err.response?.data?.error || 'Ошибка загрузки')); }
    finally { setUploading(false); input.value = ''; }
  }
  return <div className="file-upload-block">
    {currentFile && <div className="current-file"><span className="file-icon">{currentType?.includes('sheet') ? 'Excel' : currentType?.includes('word') ? 'Word' : tr('Файл')}</span><DownloadFile taskId={taskId} filename={currentFile} /></div>}
    {!readOnly && <label className="upload-btn">{tr(uploading ? 'Загрузка...' : currentFile ? 'Заменить файл' : 'Загрузить файл')}<input type="file" accept=".doc,.docx,.xls,.xlsx,.pdf,.jpg,.jpeg,.png" onChange={upload} disabled={uploading} hidden /></label>}
    {error && <div className="error-msg" role="alert">{error}</div>}
  </div>;
}
