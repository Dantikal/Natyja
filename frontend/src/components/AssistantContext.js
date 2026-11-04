import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import api from '../api/axios';
import { remaining } from '../utils/taskDeadlines';
export default forwardRef(function AssistantContext({ onChange, disabled, onUploadError }, ref) {
  const { lang } = useLang(); const ky = lang === 'ky';
  const [documents, setDocuments] = useState([]), [selected, setSelected] = useState([]);
  const [tasks, setTasks] = useState([]), [taskId, setTaskId] = useState('');
  const [web, setWeb] = useState(false), [webQuery, setWebQuery] = useState('');
  const [uploading, setUploading] = useState(false), [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null), [now, setNow] = useState(Date.now());
  const [folder, setFolder] = useState(null);
  useEffect(() => { onUploadError?.(error); }, [error, onUploadError]);
  useEffect(() => {
    let active = true;
    async function load() {
      try { const { data } = await api.get('/assistant-support/local-knowledge'); if (active) { setFolder(data); if (data.enabled) setWeb(false); } } catch {}
    }
    load(); const timer = setInterval(load, 10000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    api.get('/assistant-support/documents', { signal: controller.signal }).then(res => setDocuments(res.data)).catch(() => {});
    async function loadTasks() { try { const { data } = await api.get('/assistant-support/tasks', { signal: controller.signal }); setTasks(data.tasks); setNow(new Date(data.serverNow).getTime()); } catch {} }
    loadTasks(); const timer = setInterval(() => { if (!document.hidden) loadTasks(); }, 60000);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);
  useEffect(() => { onChange({ documentIds: selected, attachments: documents.filter(doc => selected.includes(doc.id)).map(({ id, name }) => ({ id, name })), ...(taskId ? { taskId: Number(taskId) } : {}), ...(web ? { webQuery: webQuery.trim() } : {}), webEnabled: web, uploading }); }, [selected, documents, taskId, web, webQuery, uploading, onChange]);
  useImperativeHandle(ref, () => ({ upload, removeSelection(id) { setSelected(ids => ids.filter(value => value !== id)); } }));
  async function upload(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (disabled || uploading) return;
    if (selected.length >= 3) { setError(ky ? '3 файл тандалган. Бирин алып салыңыз.' : 'Уже выбраны 3 файла. Уберите один из вложений.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError(ky ? 'Файл 5 МБдан чоң.' : 'Файл больше 5 МБ.'); return; }
    setUploading(true); setError('');
    try {
      const body = new FormData(); body.append('file', file);
      const { data } = await api.post('/assistant-support/documents', body, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 75000 });
      setDocuments(items => [...items, data]); setSelected(ids => ids.length < 3 ? [...ids, data.id] : ids);
    } catch (err) { setError(err.response?.data?.error || (ky ? 'Файл жүктөлгөн жок.' : 'Не удалось загрузить файл.')); }
    finally { setUploading(false); }
  }
  async function remove() {
    try { await api.delete('/assistant-support/documents/' + confirm); setDocuments(items => items.filter(doc => doc.id !== confirm)); setSelected(ids => ids.filter(id => id !== confirm)); setConfirm(null); }
    catch { setError(ky ? 'Өчүрүлгөн жок.' : 'Не удалось удалить документ.'); }
  }
  return <div className="assistant-context"><details><summary>{ky ? 'Документтер жана задачалар' : 'Документы и мои задачи'}</summary>
    {error && <p role="alert">{error}</p>}
    {folder?.enabled && <section aria-label={ky ? 'Жергиликтүү билим папкасы' : 'Локальная папка знаний'}>
      <strong>{ky ? 'ПКдагы билим папкасы' : 'Папка знаний на этом ПК'}</strong>
      <p style={{ overflowWrap: 'anywhere' }}>{folder.path}</p>
      <p>{ky ? 'Документтерди же папкаларды бул жерге көчүрүңүз. Жаңыртуу автоматтык түрдө жүргүзүлөт.' : 'Копируйте сюда документы или папки. Проверка изменений — каждые 30 секунд, пока открыт помощник. Подходящие фрагменты используются в ответах автоматически.'}</p>
      <p>{folder.scanning ? (ky ? 'Окулууда…' : 'Читаю документы…') : (ky ? `Окулган файлдар: ${folder.count}` : `Прочитано файлов: ${folder.count}`)}</p>
      <p>{ky ? 'TXT, MD, DOCX, PDF. Ар бир файл 5 МБга чейин, жалпы 300 файл. Скан үчүн OCR керек.' : 'TXT, MD, DOCX, PDF. До 5 МБ на файл, до 300 файлов. До 80 000 знаков из файла; PDF — первые 40 страниц, сканам нужен OCR.'}</p>
      <p>{ky ? 'Модель жана документтер ушул ПКда. Бул папка онлайн шилтемеде жеткиликтүү эмес.' : 'Модель и документы остаются на этом ПК. Через публичную ссылку эта папка недоступна. Это справочная память, а не переобучение модели.'}</p>
      {folder.error && <p role="alert">{folder.error}</p>}
      {!!folder.skipped && <p role="alert">{ky ? 'Чектен ашкан файлдар бар.' : 'Есть файлы или папки сверх лимита.'}</p>}
      {folder.files?.map(file => <p key={file.id}>{file.name}{file.limited ? ' *' : ''}</p>)}
      {folder.errors?.map(file => <p role="alert" key={file.name}>{file.name}: {file.error}</p>)}
      <button type="button" disabled={disabled || folder.scanning} onClick={async () => {
        try { const { data } = await api.post('/assistant-support/local-knowledge/refresh'); setFolder(data); }
        catch { setError(ky ? 'Жаңыртуу мүмкүн эмес.' : 'Не удалось обновить папку.'); }
      }}>{ky ? 'Папканы текшерүү' : 'Проверить папку сейчас'}</button>
    </section>}
    <label className="assistant-upload">{uploading ? (ky ? 'Жүктөлүүдө…' : 'Загружаем…') : (ky ? '＋ Документ жүктөө' : '＋ Загрузить документ')}<input type="file" aria-label={ky ? 'Документ жүктөө' : 'Загрузить документ'} accept=".txt,.docx,.pdf,.jpg,.jpeg,.png" disabled={disabled || uploading} onChange={upload} /></label>
    <p>{ky ? 'JPG/PNG: сүрөттөгү орусча жана англисче текстти окуйт. Сүрөттүн мазмунун талдабайт.' : 'JPG/PNG: читает русский и английский текст на фото. Объекты и сцены не распознаёт. Оригинал фото не сохраняется.'}</p>
    <p>{ky ? 'TXT, DOCX, PDF · 5 МБ. Жеке документтер. PDF: алгачкы 40 бет, скан окулбайт.' : 'TXT, DOCX, PDF · 5 МБ. Документы личные. PDF: первые 40 страниц; сканы не распознаются.'}</p>
    {documents.map(doc => <div className="assistant-document" key={doc.id}><label><input type="checkbox" checked={selected.includes(doc.id)} disabled={disabled || (!selected.includes(doc.id) && selected.length >= 3)} onChange={event => setSelected(ids => event.target.checked ? [...ids, doc.id] : ids.filter(id => id !== doc.id))} />{doc.name}{doc.limited ? ' *' : ''}</label><button type="button" disabled={disabled || uploading} onClick={() => setConfirm(doc.id)} aria-label={(ky ? 'Документти өчүрүү: ' : 'Удалить документ: ') + doc.name}>×</button></div>)}
    {!!documents.length && <p>{ky ? 'Жоопко 3 документке чейин тандаңыз. Чоң тексттен тиешелүү бөлүктөрү колдонулат.' : 'Выберите до 3 документов для ответа. Из больших текстов используются подходящие фрагменты, до 80 000 знаков из файла.'}</p>}
    {confirm && <div className="assistant-confirm"><p>{ky ? 'Документти өчүрөсүзбү?' : 'Удалить документ?'}</p><button type="button" onClick={remove}>{ky ? 'Өчүрүү' : 'Удалить'}</button>{' '}<button type="button" onClick={() => setConfirm(null)}>{ky ? 'Жокко чыгаруу' : 'Отмена'}</button></div>}
    <label htmlFor="assistant-task">{ky ? 'Менин задачам' : 'Моя задача'}</label><select id="assistant-task" value={taskId} disabled={disabled} onChange={event => setTaskId(event.target.value)}><option value="">{ky ? 'Задача тандалган эмес' : 'Без задачи'}</option>{tasks.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select>
    {tasks.filter(task => String(task.id) === taskId).map(task => <div key={task.id} className="assistant-task-card"><strong>{task.title}</strong><p>{task.status.replace(/_/g, ' ')}</p><p>{remaining(task.due_date, now, ky)}</p>{task.due_date && <p>{new Date(task.due_date).toLocaleString(ky ? 'ky-KG' : 'ru-RU', { timeZone: 'Asia/Bishkek' })} · Бишкек</p>}<p>{ky ? 'Срок — көрсөтүлгөн күндүн аягына чейин (Бишкек).' : 'Срок — до конца указанного дня по Бишкеку.'}</p><p>{ky ? 'Сураңыз: «Бул задача боюнча отчётту кантип даярдайм?»' : 'Спросите: «Как подготовить отчёт по этой задаче?»'}</p><Link to="/my-tasks">{ky ? 'Задачаларды ачуу' : 'Открыть мои задачи'}</Link></div>)}
    {!tasks.length && <p>{ky ? 'Азыр активдүү задача жок.' : 'Сейчас активных задач нет.'}</p>}
    <p>{ky ? 'Сайт ачык турганда срок тууралуу эскертет.' : 'Напоминания о сроках работают, пока сайт открыт.'}</p>
  </details>
    {!folder?.enabled && <label className="assistant-web-toggle"><input type="checkbox" checked={web} disabled={disabled} onChange={event => setWeb(event.target.checked)} />{ky ? 'Интернеттен издөө' : 'Искать в интернете'}</label>}
    {web && <div className="assistant-web-query"><label htmlFor="assistant-search">{ky ? 'Издөө сөздөрү' : 'Поисковые слова'}</label><input id="assistant-search" placeholder={ky ? 'Мисалы: Бишкек' : 'Например: Бишкек'} value={webQuery} maxLength={160} disabled={disabled} onChange={event => setWebQuery(event.target.value)} /><p>{ky ? 'Википедиядан издейт. Бул сөздөр гана интернетке жөнөтүлөт. Документтер жана задачалар жөнөтүлбөйт.' : 'Справочный поиск в Википедии. Только эти слова отправятся в интернет. Документы и задачи туда не передаются.'}</p></div>}
  </div>;
});

