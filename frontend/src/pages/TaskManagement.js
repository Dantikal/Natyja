import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';

export default function TaskManagement() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [tasks, setTasks] = useState([]);
  const [soldiers, setSoldiers] = useState([]);
  const [positions, setPositions] = useState([]);
  const [report, setReport] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ soldierId: '', unitId: '', taskDirection: '', requiredPositionId: '', title: '', description: '', priority: 'обычная', dueDate: '' });
  const [assignments, setAssignments] = useState({});
  const [transfers, setTransfers] = useState({});
  const [history, setHistory] = useState({});
  const [openHistory, setOpenHistory] = useState({});
  const [redistribution, setRedistribution] = useState({ fromSoldierId: '', toSoldierId: '', reason: 'Отпуск' });

  const loadData = useCallback(async (selectedYear = year) => {
    setLoading(true);
    setError('');
    try {
      const [taskResult, soldierResult, reportResult, positionsResult] = await Promise.all([
        api.get('/tasks'),
        api.get('/soldiers'),
        api.get('/tasks/annual', { params: { year: selectedYear } }),
        api.get('/dictionaries/positions'),
      ]);
      setTasks(taskResult.data);
      setSoldiers(soldierResult.data);
      setReport(reportResult.data.report);
      setPositions(positionsResult.data);
    } catch (err) {
      setError(err.response?.data?.error || t('taskDataError'));
    } finally {
      setLoading(false);
    }
  }, [year, t]);

  useEffect(() => { loadData(); }, [loadData]);
  async function createTask(event) {
    event.preventDefault();
    try {
      await api.post('/tasks', form);
      setForm({ soldierId: '', unitId: '', taskDirection: '', requiredPositionId: '', title: '', description: '', priority: 'обычная', dueDate: '' });
      await loadData();
    } catch (err) { setError(err.response?.data?.error || t('taskCreatedError')); }
  }

  async function assignTask(task) {
    const draft = assignments[task.id] || {};
    if (!draft.toSoldierId || !draft.reason?.trim()) { setError(`${t('chooseExecutor')}: ${t('assignmentComment')}`); return; }
    try { await api.post(`/tasks/${task.id}/assign`, draft); await loadData(); }
    catch (err) { setError(err.response?.data?.error || t('taskDataError')); }
  }

  async function transferTask(task) {
    const draft = transfers[task.id] || {};
    if (!draft.toSoldierId || !draft.reason?.trim()) {
      setError(t('transferReason'));
      return;
    }
    try {
      await api.post(`/tasks/${task.id}/transfer`, draft);
      await loadData();
    } catch (err) { setError(err.response?.data?.error || t('taskCreatedError')); }
  }

  async function redistributeTasks(event) {
    event.preventDefault();
    try {
      const response = await api.post('/tasks/redistribute', redistribution);
      setError('');
      window.alert(response.data.message);
      setRedistribution({ fromSoldierId: '', toSoldierId: '', reason: 'Отпуск' });
      await loadData();
    } catch (err) { setError(err.response?.data?.error || t('taskDataError')); }
  }

  async function toggleHistory(taskId) {
    const isOpen = Boolean(openHistory[taskId]);
    setOpenHistory({ ...openHistory, [taskId]: !isOpen });
    if (!isOpen && !history[taskId]) {
      try {
        const response = await api.get(`/tasks/${taskId}/transfers`);
        setHistory({ ...history, [taskId]: response.data });
      } catch (err) { setError(err.response?.data?.error || t('taskDataError')); }
    }
  }
  async function deleteTask(task) {
    if (!window.confirm(`${t('deleteTaskConfirm')} «${task.title}»?`)) return;
    try { await api.delete(`/tasks/${task.id}`); await loadData(); }
    catch (err) { setError(err.response?.data?.error || t('taskDataError')); }
  }

  async function downloadReport(task) {
    try {
      const response = await api.get(`/tasks/${task.id}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = task.report_file;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(err.response?.data?.error || t('taskDataError')); }
  }

  function exportCsv() {
    const rows = [[t('rankNumber'), t('colFio'), t('selectUnit'), t('assignedCount'), t('completedCount'), t('lateCount'), t('failedCount'), t('transferredCount'), t('bonusPoints'), t('ratingPoints')]];
    report.forEach((row, index) => rows.push([index + 1, row.fullName, row.unitName || '', row.assigned, row.completed, row.late, row.failed, row.transferredOut, row.bonusPoints, row.rating == null ? '' : row.rating]));
    const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `rating-${year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportWord() {
    const rows = report.map((row, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(row.fullName)}</td><td>${escapeHtml(row.unitName || '')}</td><td>${row.assigned}</td><td>${row.completed}</td><td>${row.late}</td><td>${row.failed}</td><td>${row.transferredOut}</td><td>${row.bonusPoints}</td><td>${row.rating ?? ''}</td></tr>`).join('');
    const html = reportDocumentHtml(t('annualRating'), year, rows, t);
    const blob = new Blob([`\ufeff${html}`], { type: 'application/msword;charset=utf-8' });
    downloadBlob(blob, `rating-${year}.doc`);
  }

  function exportPdf() {
    const rows = report.map((row, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(row.fullName)}</td><td>${escapeHtml(row.unitName || '')}</td><td>${row.assigned}</td><td>${row.completed}</td><td>${row.late}</td><td>${row.failed}</td><td>${row.transferredOut}</td><td>${row.bonusPoints}</td><td>${row.rating ?? ''}</td></tr>`).join('');
    const printWindow = window.open('', '_blank');
    if (!printWindow) { setError(t('allowPrintWindow')); return; }
    printWindow.document.write(reportDocumentHtml(t('annualRating'), year, rows, t));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <main className="container task-management">
      <div className="page-title-row"><h1>{t('taskManagement')}</h1><button className="btn-secondary" onClick={() => loadData()}>{t('update')}</button></div>
      {error && <div className="error-msg">{error}</div>}

      <section className="soldier-form task-create-form">
        <h2>{t('createTask')}</h2>
        <form onSubmit={createTask}>
          {user?.role === 'admin' ? <label>{t('selectUnit')} *
            <select value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} required>
              <option value="">{t('chooseUnit')}</option>
              {[...new Map(soldiers.filter((person) => person.unit_id).map((person) => [String(person.unit_id), { id: person.unit_id, name: person.military_unit_name }])).values()].map((unit) => <option value={unit.id} key={unit.id}>{unit.name || `${t('unitGeneric')} ${unit.id}`}</option>)}
            </select><small>{t('taskGoesToCommander')}</small>
          </label> : <label>{t('responsibleEmployee')} *
            <select value={form.soldierId} onChange={(e) => setForm({ ...form, soldierId: e.target.value })} required>
              <option value="">{t('chooseEmployee')}</option>
              {soldiers.filter((person) => !form.requiredPositionId || String(person.position_id) === String(form.requiredPositionId)).map((person) => <option value={person.id} key={person.id}>{person.full_name}</option>)}
            </select>
          </label>}
          <div className="two-cols">
            <label>{t('taskDirection')} *<input value={form.taskDirection} onChange={(e) => setForm({ ...form, taskDirection: e.target.value, soldierId: '' })} placeholder={t('taskDirectionExample')} required /></label>
            <label>{t('responsiblePosition')} *<select required value={form.requiredPositionId} onChange={(e) => setForm({ ...form, requiredPositionId: e.target.value, soldierId: '' })}><option value="">{t('choosePosition')}</option>{positions.map((position) => <option key={position.id} value={position.id}>{position.name}</option>)}</select></label>
          </div>
          <label>{t('taskTitle')} *<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
          <label>{t('description')}<textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <div className="two-cols">
            <label>{t('priority')}<select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="обычная">{t('normal')}</option><option value="высокая">{t('high')}</option><option value="срочная">{t('urgent')}</option></select></label>
            <label>{t('dueDate')} *<input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required /></label>
          </div>
          <button className="btn-primary" type="submit">{user?.role === 'admin' ? t('sendToCommander') : t('assignTask')}</button>
        </form>
      </section>

      {(user?.role === 'admin' || user?.role === 'commander') && <section className="soldier-form task-create-form">
        <h2>{t('redistributeOnLeave')}</h2>
        <p>{t('redistributeOnLeaveHelp')}</p>
        <form onSubmit={redistributeTasks}>
          <div className="two-cols">
            <label>{t('employeeOnLeave')} *<select required value={redistribution.fromSoldierId} onChange={(e) => setRedistribution({ ...redistribution, fromSoldierId: e.target.value })}><option value="">{t('chooseEmployee')}</option>{soldiers.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>
            <label>{t('newExecutor')} *<select required value={redistribution.toSoldierId} onChange={(e) => setRedistribution({ ...redistribution, toSoldierId: e.target.value })}><option value="">{t('chooseExecutor')}</option>{soldiers.filter((person) => String(person.id) !== String(redistribution.fromSoldierId)).map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>
          </div>
          <label>{t('transferReason')} *<input required value={redistribution.reason} onChange={(e) => setRedistribution({ ...redistribution, reason: e.target.value })} /></label>
          <button className="btn-primary" type="submit">{t('redistributeTasks')}</button>
        </form>
      </section>}

      <section className="task-management-list">
        <h2>{t('currentTasks')}</h2>
        {loading ? <p>{t('loading')}</p> : tasks.length === 0 ? <p>{t('noTasks')}</p> : tasks.map((task) => {
          const draft = transfers[task.id] || {};
          return (
            <article className="task-card" key={task.id}>
              <div className="task-header"><div><h3>{task.title}</h3><div className="task-meta"><span>{t('responsible')}: {task.soldier_name || '—'}</span><span>{t('dueDate')}: {new Date(task.due_date).toLocaleDateString(lang === 'ky' ? 'ky-KG' : 'ru-RU')}</span><span>{task.status === 'новая' ? t('statusNew') : task.status === 'в_работе' ? t('statusWorking') : task.status === 'выполнена' ? t('statusDone') : t('statusFailed')}</span></div></div><button className="btn-small btn-danger" onClick={() => deleteTask(task)}>{t('delete')}</button></div>
              {task.task_direction && <p className="task-desc"><b>{t('taskDirection')}:</b> {task.task_direction} · {positions.find((position) => String(position.id) === String(task.required_position_id))?.name || ''}</p>}
              {task.description && <p className="task-desc">{task.description}</p>}
              {task.original_soldier_name && <p>{t('originalAssignee')}: {task.original_soldier_name} · {t('transferredResponsibility')}</p>}
              {task.failure_reason && <p><b>{t('failureReasonLabel')}:</b> {task.failure_reason}</p>}
              {task.status === 'выполнена' && <p><b>{t('automaticScore')}:</b> {task.automatic_points} {t('pointsShort')}</p>}
              {user?.role === 'commander' && task.assignment_stage === 'commander' && <div className="task-review-row"><b>{t('assignedForDistribution')}</b><label>{t('executor')}<select value={assignments[task.id]?.toSoldierId || ''} onChange={(e) => setAssignments({ ...assignments, [task.id]: { ...assignments[task.id], toSoldierId: e.target.value } })}><option value="">{t('chooseExecutor')}</option>{soldiers.filter((person) => String(person.id) !== String(task.soldier_id) && (!task.required_position_id || String(person.position_id) === String(task.required_position_id))).map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label><label>{t('assignmentComment')}<input value={assignments[task.id]?.reason || ''} onChange={(e) => setAssignments({ ...assignments, [task.id]: { ...assignments[task.id], reason: e.target.value } })} /></label><button className="btn-small green" onClick={() => assignTask(task)}>{t('assignToExecutor')}</button></div>}
              <button className="btn-small" onClick={() => toggleHistory(task.id)}>{openHistory[task.id] ? t('hideHistory') : t('transferHistory')}</button>
              {openHistory[task.id] && <ul className="transfer-history">{(history[task.id] || []).map((item) => <li key={item.id}>{item.transfer_type === 'assignment' ? t('commanderAssignment') : t('employeeTransfer')}: {item.from_name} → {item.to_name} · {new Date(item.created_at).toLocaleDateString(lang === 'ky' ? 'ky-KG' : 'ru-RU')} · {item.reason}{Number(item.bonus_points) > 0 ? ` · +${item.bonus_points} ${t('bonusPoints')}` : ''}</li>)}{history[task.id]?.length === 0 && <li>{t('noTransfers')}</li>}</ul>}
              {task.report_file && <button className="btn-small" onClick={() => downloadReport(task)}>{t('reportDownload')}</button>}
              {task.assignment_stage === 'executor' && ['новая', 'в_работе'].includes(task.status) && (
                <div className="task-review-row">
                  <label>{t('transferToEmployee')}<select value={draft.toSoldierId || ''} onChange={(e) => setTransfers({ ...transfers, [task.id]: { ...draft, toSoldierId: e.target.value } })}><option value="">{t('choose')}</option>{soldiers.filter((person) => String(person.id) !== String(task.soldier_id) && (!task.required_position_id || String(person.position_id) === String(task.required_position_id))).map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>
                  <label>{t('transferReason')}<input value={draft.reason || ''} onChange={(e) => setTransfers({ ...transfers, [task.id]: { ...draft, reason: e.target.value } })} /></label>
                  <button className="btn-small" onClick={() => transferTask(task)}>{t('transferWithBonus')}</button>
                </div>
              )}
            </article>
          );
        })}
      </section>

      <section className="annual-report">
        <div className="page-title-row"><h2>{t('annualRating')}</h2><div><select value={year} onChange={(e) => { const next = Number(e.target.value); setYear(next); loadData(next); }}>{[year - 1, year, year + 1].map((item) => <option value={item} key={item}>{item}</option>)}</select> <button className="btn-secondary" onClick={exportCsv}>{t('downloadExcel')}</button> <button className="btn-secondary" onClick={exportWord}>{t('downloadWord')}</button> <button className="btn-secondary" onClick={exportPdf}>{t('downloadPdf')}</button></div></div>
        <div className="table-wrap"><table><thead><tr><th>{t('rankNumber')}</th><th>{t('colFio')}</th><th>{t('selectUnit')}</th><th>{t('assignedCount')}</th><th>{t('completedCount')}</th><th>{t('lateCount')}</th><th>{t('failedCount')}</th><th>{t('transferredCount')}</th><th>{t('bonusPoints')}</th><th>{t('ratingPoints')}</th></tr></thead><tbody>{report.map((row, index) => <tr key={row.soldierId}><td>{index + 1}</td><td>{row.fullName}</td><td>{row.unitName || '—'}</td><td>{row.assigned}</td><td>{row.completed}</td><td>{row.late}</td><td>{row.failed}</td><td>{row.transferredOut}</td><td>{row.bonusPoints}</td><td><b>{row.rating == null ? '—' : `${row.rating} ${t('pointsShort')}`}</b></td></tr>)}{!report.length && <tr><td colSpan="10" className="empty-row">{t('noTasksForYear')}</td></tr>}</tbody></table></div>
      </section>
    </main>
  );
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function reportDocumentHtml(title, year, rows, t) {
  const headers = ['#', t('colFio'), t('selectUnit'), t('assignedCount'), t('completedCount'), t('lateCount'), t('failedCount'), t('transferredCount'), t('bonusPoints'), t('ratingPoints')];
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)} ${year}</title><style>body{font-family:Arial,sans-serif;margin:24px}h1{font-size:20px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #777;padding:6px;text-align:left}th{background:#e8edf3}</style></head><body><h1>${escapeHtml(title)} · ${year}</h1><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
}
