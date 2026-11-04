import { useLang } from "../context/LanguageContext";
import { useState, useEffect, useCallback, useRef } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";


import FileUpload from "../components/FileUpload";
import { WordEditor, ExcelEditor } from '../components/DeferredEditors';
import TaskAttachment from '../components/TaskAttachment';
import ReportEditorModal from '../components/ReportEditorModal';
import ReportAiAssessment,{useReportAssessments} from '../components/ReportAiAssessment';
export default function TasksAdmin() {
  const {
    tr,
    lang
  } = useLang();
  const [tasks, setTasks] = useState([]);
  const [soldiers, setSoldiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(null);
  const [viewingTask, setViewingTask] = useState(null);
  const [reportingTask, setReportingTask] = useState(null);
  const [parentTaskId, setParentTaskId] = useState(null);
  const [tab, setTab] = useState("all"); // all | review | done
  const {
    user
  } = useAuth();
  const isAdmin = user?.role === "admin";
  const [error, setError] = useState('');
  const {reviews,refresh:refreshReviews}=useReportAssessments();
  const loadAll = useCallback(async () => {
    setError('');
    try {
      const tasksRes = await api.get("/tasks");
      setTasks(tasksRes.data);
      if (isAdmin) {
        // Если админ — грузим только КОМАНДИРОВ
        const cmdrsRes = await api.get("/users/commanders");
        setSoldiers(cmdrsRes.data);
      } else {
        // Если командир — грузим своих подчиненных
        const soldiersRes = await api.get("/soldiers");
        setSoldiers(soldiersRes.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);
  useEffect(() => { loadAll(); }, [loadAll]);
  async function handleDelete(id) {
    if (!window.confirm(tr("Удалить задачу?"))) return;
    try { await api.delete(`/tasks/${id}`); await loadAll(); } catch (err) { setError(err.response?.data?.error || 'Ошибка'); }
  }

  // Фильтр по табам
  let filtered = tasks;
  if (tab === "review") filtered = tasks.filter(t => t.status === "на_проверке");
  if (tab === "done") filtered = tasks.filter(t => t.status === "выполнена");
  if (tab === 'ai') filtered=tasks.filter(task=>task.status==='на_проверке'&&reviews[task.id]&&!['queued','running'].includes(reviews[task.id].state));
  const reviewCount = tasks.filter(t => t.status === "на_проверке").length;
  if (loading) return <div className="container"><p>{tr("Загрузка...")}</p></div>;
  return <div className="container">
    {error && <div className="error-msg" role="alert">{tr(error)}</div>}
      <div className="page-title-row">
        <h1>{isAdmin ? tr("Все задачи") : tr("Задачи моей части")}</h1>
        <button className="btn-primary" onClick={() => {
        setParentTaskId(null);
        setShowCreate(true);
      }}>{tr("+ Новая задача")}</button>
      </div>

      <div className="tabs">
        <button className={tab==='ai'?'active':''} onClick={()=>setTab('ai')}>{lang==='ky'?'ИИ текшерүүлөрү':'Проверки ИИ'} ({tasks.filter(task=>task.status==='на_проверке'&&reviews[task.id]&&!['queued','running'].includes(reviews[task.id].state)).length})</button>
        <button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>{tr("Все") + " ("}{tasks.length})
        </button>
        <button className={tab === "review" ? "active" : ""} onClick={() => setTab("review")}>{tr("На проверке") + " ("}{reviewCount})
        </button>
        <button className={tab === "done" ? "active" : ""} onClick={() => setTab("done")}>{tr("Принятые")}</button>
      </div>

      {filtered.length === 0 ? <div className="empty-state">
          <p>{tr("Задач нет")}</p>
        </div> : <div className="tasks-list">
          {filtered.map(task => <div key={task.id} className={`task-card ${task.status}`}>
              <div className="task-header">
                <div>
                  <h3>{task.title}</h3>
                  <div className="task-meta">
                    <span className={`priority priority-${task.priority}`}>{tr(task.priority)}</span>
                    <span className={`classification classification-${task.classification}`}>
                      {tr(task.classification)}
                    </span>
                    <span className="task-due">{tr("До:")}{new Date(task.due_date).toLocaleDateString(lang === "ky" ? "ky-KG" : "ru-RU")}
                    </span>
                  </div>
                  <div className="task-soldier-info">
                    <b>{task.soldier_name}</b>
                    {task.rank_name && ` · ${task.rank_name}`}
                    {task.unit_name && ` · ${task.unit_name}`}
                  </div>
                </div>
                <span className={`status-badge status-${task.status}`}>
                  {task.status === "новая" ? tr("Новая") : task.status === "в_работе" ? tr("В работе") : task.status === "на_проверке" ? tr("На проверке") : task.status === "выполнена" ? tr("Принята") : tr("Провалена")}
                </span>
              </div>

              {task.description && <p className="task-desc">{task.description}</p>}
              <TaskAttachment task={task} />
              <ReportAiAssessment review={reviews[task.id]} taskId={task.id} submitted={task.status==='на_проверке'} own={Number(task.soldier_id)===Number(user.soldierId??user.soldier_id)} onUpdated={refreshReviews}/>
              {task.parent_task_id && <p className="task-relation">{tr('Основная задача')}: {tasks.find(parent => parent.id === task.parent_task_id)?.title || `#${task.parent_task_id}`}</p>}
              {tasks.some(child => child.parent_task_id === task.id) && <div className="task-relation"><b>{tr('Поручено подчинённым')}:</b><ul>{tasks.filter(child => child.parent_task_id === task.id).map(child => <li key={child.id}>{child.soldier_name} — {child.title} · {tr(child.status === 'выполнена' ? 'Принята' : child.status === 'на_проверке' ? 'На проверке' : child.status === 'провалена' ? 'Провалена' : child.status === 'в_работе' ? 'В работе' : 'Новая')}</li>)}</ul></div>}

              <div className="task-actions">
              {!isAdmin && Number(task.soldier_id) === Number(user.soldierId ?? user.soldier_id) && ['новая', 'в_работе'].includes(task.status) && <button className="btn-small btn-primary" onClick={() => setReportingTask(task)}>{tr(task.report_html || task.report_table_json || task.report_file ? 'Изменить отчёт' : 'Написать отчёт')}</button>}
              <button className="btn-small btn-primary" onClick={() => setViewingTask(task)}>
              {task.status === "на_проверке" ? tr("Проверить отчёт") : task.report_html || task.report_table_json ? tr("Просмотр отчёта") : tr("Просмотр")}
             </button>

               {!isAdmin && Number(task.soldier_id) === Number(user.soldierId) && !["выполнена", "провалена"].includes(task.status) && <button className="btn-small" onClick={() => {
            setParentTaskId(task.id);
            setShowCreate(true);
          }}>{tr("Делегировать")}</button>}

                  {isAdmin && <button className="btn-small btn-danger" onClick={() => handleDelete(task.id)}>{tr("Удалить")}</button>}
                 </div>
                 </div>)}
             </div>}

      {showCreate && <CreateTaskModal soldiers={soldiers.filter(s => isAdmin || Number(s.id) !== Number(user.soldierId))} parentTaskId={parentTaskId} parentTask={tasks.find(t => t.id === parentTaskId)} onClose={() => {
      setShowCreate(false);
      setParentTaskId(null);
    }} onCreated={() => {
      setShowCreate(false);
      setParentTaskId(null);
      loadAll();
    }} />}

      {viewingTask && <TaskViewModal task={viewingTask} aiReview={reviews[viewingTask.id]} refreshReviews={refreshReviews} onClose={() => setViewingTask(null)} onUpdated={() => {
      setViewingTask(null);
      loadAll();
    }} />}
      {reportingTask && <ReportEditorModal task={reportingTask} onClose={() => setReportingTask(null)} onSaved={() => { setReportingTask(null); loadAll(); }} />}
    </div>;
}

// ============ МОДАЛЬНОЕ ОКНО СОЗДАНИЯ ============
// ============ МОДАЛЬНОЕ ОКНО СОЗДАНИЯ / ДЕЛЕГИРОВАНИЯ ============
function CreateTaskModal({
  soldiers,
  parentTaskId,
  parentTask,
  onClose,
  onCreated
}) {
  const {
    tr
  } = useLang();
  const [form, setForm] = useState({
    soldierId: "",
    title: parentTask?.title || "",
    description: parentTask?.description || "",
    priority: parentTask?.priority || "обычная",
    classification: parentTask?.classification || "открыто",
    dueDate: parentTask?.due_date?.slice(0, 10) || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attachment, setAttachment] = useState(null);
  const fileRef = useRef(null);
  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => data.append(key, value));
      if (parentTaskId) data.append('parentTaskId', parentTaskId);
      if (attachment) data.append('attachment', attachment);
      await api.post('/tasks', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || tr("Ошибка"));
    } finally {
      setSaving(false);
    }
  }
  return <div className="form-overlay">
      <form className="soldier-form" onSubmit={handleSubmit} style={{
      maxWidth: 600
    }}>
        <h2>{parentTaskId ? tr("Делегировать задачу подчинённому") : tr("Новая задача")}</h2>

        {parentTaskId && <div className="info-banner" style={{
        padding: "10px 14px",
        background: "#f0f6ff",
        borderLeft: "3px solid #1e3a5f",
        borderRadius: 6,
        marginBottom: 16,
        fontSize: 13,
        color: "#1e3a5f"
      }}>{tr("Задача создаётся на основе существующей. Выберите, кому поручить.")}</div>}

        <label>{tr("Военнослужащий *")}<select value={form.soldierId} onChange={e => setForm({
          ...form,
          soldierId: e.target.value
        })} required>
            <option value="">{tr("— выберите —")}</option>
            {soldiers.map(s => <option key={s.id} value={s.id}>
                {s.full_name} ({s.rank_name || "—"})
              </option>)}
          </select>
        </label>

        <label>{tr("Название *")}<input value={form.title} onChange={e => setForm({
          ...form,
          title: e.target.value
        })} required />
        </label>

        <label>{tr("Описание")}<textarea rows="3" value={form.description} onChange={e => setForm({
          ...form,
          description: e.target.value
        })} />
        </label>

        <div className="task-attachment-picker">
          <label>{tr('Документ к задаче (необязательно)')}
            <input ref={fileRef} type="file" accept=".doc,.docx,.xls,.xlsx,.pdf,.jpg,.jpeg,.png" disabled={saving} onChange={event => {
              const file = event.target.files?.[0];
              setError('');
              if (file && file.size > 10 * 1024 * 1024) { setError(tr('Файл не должен превышать 10 МБ')); event.target.value = ''; setAttachment(null); return; }
              setAttachment(file || null);
            }} />
          </label>
          <small>{tr('Word, Excel, PDF, JPG или PNG. До 10 МБ.')}</small>
          {attachment && <div className="selected-task-file"><span>{attachment.name}</span><button type="button" className="btn-small" disabled={saving} onClick={() => { setAttachment(null); fileRef.current.value = ''; }}>{tr('Убрать файл')}</button></div>}
          {parentTask?.task_file && !attachment && <><p>{tr('Документ основной задачи будет прикреплён автоматически.')}</p><TaskAttachment task={parentTask} /></>}
        </div>

        <div className="two-cols">
          <label>{tr("Приоритет")}<select value={form.priority} onChange={e => setForm({
            ...form,
            priority: e.target.value
          })}>
              <option value="обычная">{tr("Обычная")}</option>
              <option value="важная">{tr("Важная")}</option>
              <option value="срочная">{tr("Срочная")}</option>
            </select>
          </label>

          <label>{tr("Гриф")}<select value={form.classification} onChange={e => setForm({
            ...form,
            classification: e.target.value
          })}>
              <option value="открыто">{tr("Открыто")}</option>
              <option value="ДСП">{tr("ДСП")}</option>
              <option value="секретно">{tr("Секретно")}</option>
            </select>
          </label>
        </div>

          <label>{tr("Срок сдачи *")}<input type="date" max={parentTask?.due_date?.slice(0, 10)} value={form.dueDate} onChange={e => setForm({
          ...form,
          dueDate: e.target.value
        })} required />
        </label>

        {error && <div className="error-msg">{error}</div>}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>{tr("Отмена")}</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? tr("Создание...") : tr("Создать")}
          </button>
        </div>
      </form>
    </div>;
}

// ============ ПРОСМОТР + ПРИНЯТЬ / ОТКЛОНИТЬ ============
function TaskViewModal({
  task,
  aiReview,refreshReviews,
  onClose,
  onUpdated
}) {
  const {
    tr,
    lang
  } = useLang();
  const [comment, setComment] = useState(task.admin_comment || "");
  const [qualityPoints,setQualityPoints]=useState('');
  const [rejectionReason, setRejectionReason] = useState("");
  const [mode, setMode] = useState("view"); // view | reject
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function handleApprove() {
    setSaving(true);
    setError("");
    try {
      await api.patch(`/tasks/${task.id}/approve`, {
        adminComment: comment, qualityPoints:Number(qualityPoints)
      });
      onUpdated();
    } catch (err) {
      setError(err.response?.data?.error || tr("Ошибка"));
    } finally {
      setSaving(false);
    }
  }
  async function handleReject() {
    if (!rejectionReason.trim()) {
      setError(tr("Укажите причину отклонения"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.patch(`/tasks/${task.id}/reject`, {
        rejectionReason
      });
      onUpdated();
    } catch (err) {
      setError(err.response?.data?.error || tr("Ошибка"));
    } finally {
      setSaving(false);
    }
  }
  const { user } = useAuth();
  const canReview = task.status === "на_проверке" && Number(task.soldier_id) !== Number(user.soldierId) && (task.assignment_stage !== 'commander' || user.role === 'admin');
  return <div className="form-overlay">
      <div className="soldier-form" style={{
      maxWidth: 900
    }}>
        <h2>{tr("Проверка задачи")}</h2>
        <ReportAiAssessment review={aiReview} taskId={task.id} submitted={task.status==='на_проверке'} onUpdated={refreshReviews}/>
        {aiReview?.state==='ready'&&<p>{lang==='ky'?'ИИнин баасынан айырмаланган чечимге кеминде 10 белгиден турган негиздеме жазыңыз.':'Если решение отличается от оценки ИИ, укажите обоснование в комментарии (не менее 10 символов).'}</p>}
        <TaskAttachment task={task} />
        <p style={{
        color: "#64748b",
        fontSize: 13,
        marginBottom: 16
      }}>
          <b>{task.title}</b> · {task.soldier_name}{tr("· До:")}{new Date(task.due_date).toLocaleDateString(lang === "ky" ? "ky-KG" : "ru-RU")}
        </p>

        {task.description && <div style={{
        marginBottom: 16
      }}>
            <div className="report-section-label">{tr("Описание")}</div>
            <p style={{
          fontSize: 14,
          lineHeight: 1.6
        }}>{task.description}</p>
          </div>}

        {/* Отчёт */}
        {/* Файл отчёта (для админа тоже) */}
          <div className="report-attachment" style={{
        marginTop: 20
      }}>
            <div className="report-section-label">{tr("Прикреплённый файл:")}</div>
             <FileUpload taskId={task.id} currentFile={task.report_file} currentType={task.report_file_type} readOnly />
        </div>
        {task.report_html || task.report_table_json ? <div style={{
        marginBottom: 16
      }}>
            <div className="report-section-label">{tr("Отчёт военнослужащего")}</div>

            {task.report_type === "text" && task.report_html && <div className="word-editor-wrap readonly">
                <WordEditor value={task.report_html} readOnly task={task} />
              </div>}

            {task.report_type === "table" && task.report_table_json && <ExcelEditor value={task.report_table_json} readOnly task={task} />}
            {task.report_note && <div className="report-note-view" style={{
          marginTop: 10
        }}>
                <b>{tr("Комментарий военного:")}</b> {task.report_note}
              </div>}
          </div> : <div className="empty-state" style={{
        padding: 24,
        marginBottom: 16
      }}>
            <p>{tr("Отчёт ещё не сдан")}</p>
          </div>}

        {/* Комментарий */}
        {canReview && mode==='view' && <label>{lang==='ky'?'Аткаруунун баасы':'Оценка выполнения'} *<select value={qualityPoints} onChange={event=>setQualityPoints(event.target.value)}><option value="">{lang==='ky'?'Бааны тандаңыз':'Выберите оценку'}</option><option value="7">{lang==='ky'?'Эң жакшы — 7 упай':'Отлично — 7 баллов'}</option><option value="5">{lang==='ky'?'Жакшы — 5 упай':'Хорошо — 5 баллов'}</option><option value="3">{lang==='ky'?'Канааттандырарлык — 3 упай':'Удовлетворительно — 3 балла'}</option></select></label>}
        {task.status==='выполнена' && <p><b>{lang==='ky'?'Берилген упай':'Начислено за выполнение'}:</b> {task.awarded_points??1}</p>}
        {canReview && <>
            {mode === "view" && <label style={{
          display: "block",
          marginTop: 16
        }}>{tr("Комментарий (необязательно)")}<textarea rows="3" value={comment} onChange={e => setComment(e.target.value)} placeholder={tr("Например: молодец, принято / переделай пункт 2...")} style={{
            width: "100%",
            marginTop: 6,
            padding: "10px 12px",
            border: "1.5px solid #cbd5e1",
            borderRadius: 6,
            fontSize: 14,
            fontFamily: "inherit"
          }} />
              </label>}

            {mode === "reject" && <label style={{
          display: "block",
          marginTop: 16
        }}>{tr("Причина отклонения *")}<textarea rows="3" value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder={tr("Укажите, что нужно исправить...")} style={{
            width: "100%",
            marginTop: 6,
            padding: "10px 12px",
            border: "1.5px solid #dc2626",
            borderRadius: 6,
            fontSize: 14,
            fontFamily: "inherit"
          }} autoFocus />
              </label>}
          </>}

        {task.admin_comment && task.status === "выполнена" && <div className="admin-comment-block">
            <b>{tr("Ваш комментарий:")}</b>
            <p>{task.admin_comment}</p>
          </div>}

        {task.rejection_reason && task.status === "в_работе" && <div className="rejection-block">
            <b>{tr("Отклонено:")}</b>
            <p>{task.rejection_reason}</p>
          </div>}

        {error && <div className="error-msg">{error}</div>}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>{tr("Закрыть")}</button>

          {canReview && mode === "view" && <>
              <button type="button" className="btn-small btn-danger" onClick={() => setMode("reject")}>{tr("Отклонить")}</button>
              <button type="button" className="btn-primary green" onClick={handleApprove} disabled={saving||!qualityPoints}>
                {saving ? tr("Принятие...") : tr("Принять задачу")}
              </button>
            </>}

          {canReview && mode === "reject" && <>
              <button type="button" className="btn-secondary" onClick={() => setMode("view")}>{tr("Назад")}</button>
              <button type="button" className="btn-small btn-danger" onClick={handleReject} disabled={saving}>
                {saving ? tr("Отклонение...") : tr("Подтвердить отклонение")}
              </button>
            </>}
        </div>
      </div>
    </div>;
}



