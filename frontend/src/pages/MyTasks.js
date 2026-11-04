import ReportEditorModal from '../components/ReportEditorModal';
import PointsSummary from '../components/PointsSummary';
import ReportAiAssessment,{useReportAssessments} from '../components/ReportAiAssessment';
import { DownloadFile } from "../components/FileUpload";
import { useLang } from "../context/LanguageContext";
import { useState, useEffect } from "react";
import api from "../api/axios";



import { WordEditor, ExcelEditor } from '../components/DeferredEditors';
import TaskAttachment from '../components/TaskAttachment';
import { useAuth } from '../context/AuthContext';
export default function MyTasks() {
  const {
    tr, t, lang
  } = useLang();
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState(null);
  const {reviews,refresh:refreshReviews}=useReportAssessments(true);
  const aiPoints=Object.values(reviews).filter(item=>item.state==='ready'&&item.task_status==='на_проверке').reduce((sum,item)=>sum+Number(item.points||0),0);
  useEffect(() => {
    loadData();
  }, []);
  async function loadData() {
    try {
      const res = await api.get("/tasks/my");
      setTasks(res.data);
      if (res.data.length > 0) {
        const soldierId = res.data[0].soldier_id;
        const statsRes = await api.get(`/tasks/stats/${soldierId}`);
        setStats(statsRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }
  async function submitForReview(taskId) {
    if (!window.confirm(tr("Отправить отчёт на проверку? После этого изменить его нельзя."))) return;
    try {
      await api.patch(`/tasks/${taskId}/submit`);
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || tr("Ошибка"));
    }
  }
  async function markFailed(taskId) {
    const reason = window.prompt(tr("Причина провала задачи:"));
    if (reason === null) return;
    try {
      await api.patch(`/tasks/${taskId}/status`, {
        status: "провалена",
        reportComment: reason
      });
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || tr("Ошибка"));
    }
  }
  if (loading) return <div className="container"><p>{tr("Загрузка...")}</p></div>;
  if (tasks.length === 0) {
    return <div className="container">
        <h1>{tr("Мои задачи")}</h1>
        <PointsSummary />
        <div className="empty-state">
          <p>{tr("У вас пока нет задач.")}</p>
        </div>
      </div>;
  }
  return <div className="container">
      <h1>{tr("Мои задачи")}</h1>
      <PointsSummary />
      <div className="report-ai-total">{lang==='ky'?'ИИнин ички алдын ала упайлары':'Внутренние предварительные баллы ИИ'}: <b>{aiPoints}</b> · {lang==='ky'?'Бекитилген упайлардан өзүнчө.':'Отдельно от подтверждённых баллов.'}</div>

      {stats && <div className="stats">
          <div className="stat-card">
            <div className="label">{tr("Всего задач")}</div>
            <div className="value">{stats.total}</div>
          </div>
          <div className="stat-card green">
            <div className="label">{tr("В срок")}</div>
            <div className="value">{stats.doneOnTime}</div>
          </div>
          <div className="stat-card">
            <div className="label">{tr("С опозданием")}</div>
            <div className="value">{stats.doneLate}</div>
          </div>
          <div className="stat-card red">
            <div className="label">{tr("Провалено")}</div>
            <div className="value">{stats.failed}</div>
          </div>
          <div className="stat-card">
            <div className="label">{lang==='ky'?'Жалпы упай':'Всего баллов'}</div>
            <div className="value">{stats.taskRating} {t('pointsShort')}</div>
          </div>
        </div>}

      <div className="tasks-list">
        {tasks.map(task => <TaskCard key={task.id} task={task} aiReview={reviews[task.id]} refreshReviews={refreshReviews} onOpenReport={() => setActiveTask(task)} onSubmit={() => submitForReview(task.id)} onFail={() => markFailed(task.id)} />)}
      </div>

      {activeTask && <ReportEditorModal task={activeTask} onClose={() => setActiveTask(null)} onSaved={() => {
      setActiveTask(null);
      loadData();
    }} />}
    </div>;
}

// ============ КАРТОЧКА ЗАДАЧИ ============
function TaskCard({
  task,
  onOpenReport,
  aiReview,refreshReviews,
  onSubmit,
  onFail
}) {
  const { user } = useAuth();
  const toAdmin = user?.role === 'commander';
  const {
    tr,
    lang
  } = useLang();
  const isOverdue = new Date(task.due_date) < new Date() && task.status !== "выполнена";
  const hasReport = task.report_html || task.report_table_json || task.report_file;
  const isLocked = task.status === "на_проверке" || task.status === "выполнена";
  return <div className={`task-card ${task.status} ${isOverdue ? "overdue" : ""}`}>
      <div className="task-header">
        <div>
          <h3>{task.title}</h3>
          <div className="task-meta">
            <span className={`priority priority-${task.priority}`}>{tr(task.priority)}</span>
            <span className={`classification classification-${task.classification}`}>
              {tr(task.classification)}
            </span>
            <span className="task-due">{tr("До:")}{new Date(task.due_date).toLocaleDateString(lang === "ky" ? "ky-KG" : "ru-RU")}</span>
          </div>
        </div>
        <span className={`status-badge status-${task.status}`}>
          {task.status === "новая" ? tr("Новая") : task.status === "в_работе" ? tr("В работе") : task.status === "на_проверке" ? tr("На проверке") : task.status === "выполнена" ? tr("Принята") : tr("Провалена")}
        </span>
      </div>

      {task.description && <p className="task-desc">{task.description}</p>}
      {task.status==='выполнена'&&<p><b>{lang==='ky'?'Аткаруу үчүн упай':'Баллы за выполнение'}:</b> +{task.awarded_points??1} · {task.awarded_points===7?(lang==='ky'?'Эң жакшы':'Отлично'):task.awarded_points===5?(lang==='ky'?'Жакшы':'Хорошо'):task.awarded_points===3?(lang==='ky'?'Канааттандырарлык':'Удовлетворительно'):(lang==='ky'?'Мурунку эсеп':'Прежнее начисление')}</p>}
      <TaskAttachment task={task} />
      <ReportAiAssessment review={aiReview} taskId={task.id} submitted={task.status==='на_проверке'} own onUpdated={refreshReviews}/>

      {/* Причина отклонения */}
      {task.rejection_reason && <div className="rejection-block">
          <b>{tr(toAdmin ? 'Отклонено администратором:' : 'Отклонено командиром:')}</b>
          <p>{task.rejection_reason}</p>
        </div>}

      {/* Отчёт */}
      {hasReport && <div className="task-report-preview">
          <h4>{tr("Ваш отчёт:")}</h4>

          {task.report_type === "text" && task.report_html && <div className="word-editor-wrap readonly">
              <WordEditor value={task.report_html} readOnly task={task} />
            </div>}

          {task.report_type === "table" && task.report_table_json && <ExcelEditor value={task.report_table_json} readOnly task={task} />}

          {task.report_note && <div className="report-note-view">
              <b>{tr("Комментарий:")}</b> {task.report_note}
            </div>}
        </div>}

      {/* Комментарий командира */}
      {task.admin_comment && <div className="admin-comment-block">
          <b>{tr(toAdmin ? 'Комментарий администратора:' : 'Комментарий командира:')}</b>
          <p>{task.admin_comment}</p>
        </div>}
            {/* Прикреплённый файл */}
      {task.report_file && <div className="task-file-block">
          <DownloadFile taskId={task.id} filename={task.report_file} />
        </div>}

      {/* Информация о приёме */}
      {task.status === "выполнена" && task.approved_at && <div className="approved-info">{tr("Принято:")}{new Date(task.approved_at).toLocaleString(lang === "ky" ? "ky-KG" : "ru-RU")}
          {task.approver_name && ` · ${task.approver_name}`}
        </div>}

      {/* Кнопки */}
      {!isLocked && task.status !== "провалена" && <div className="task-actions">
          <button className="btn-small btn-primary" onClick={onOpenReport}>
            {hasReport ? tr("Изменить отчёт") : tr("Написать отчёт")}
          </button>

          {hasReport && <button className="btn-small green" onClick={onSubmit}>{tr(toAdmin ? 'Отправить администратору' : 'Отправить на проверку')}</button>}

          {!hasReport && task.status !== "новая" && <button className="btn-small btn-danger" onClick={onFail}>{tr("Провалить")}</button>}
        </div>}

      {task.status === "на_проверке" && <div className="locked-info">{tr(toAdmin ? 'Отчёт на проверке у администратора. Изменения заблокированы.' : 'Отчёт на проверке у командира. Изменения заблокированы.')}</div>}
    </div>;
}

// ============ МОДАЛЬНОЕ ОКНО ОТЧЁТА ============
