import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';

export default function UserDetailsModal({ userId, initialEdit = false, onClose, onChanged }) {
  const { user: me } = useAuth(); const { tr, lang } = useLang();
  const [data, setData] = useState(null), [dicts, setDicts] = useState({ ranks: [], positions: [], units: [] });
  const [tab, setTab] = useState('data'), [editing, setEditing] = useState(Boolean(initialEdit));
  const [form, setForm] = useState({}), [role, setRole] = useState('user');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState(''), [temporaryPassword, setTemporaryPassword] = useState(''), [copied, setCopied] = useState(false);
  const load = useCallback(async () => {
    setError('');
    try {
      const [detail, r, p, u] = await Promise.all([api.get(`/users/${userId}`), api.get('/dictionaries/ranks'), api.get('/dictionaries/positions'), api.get('/dictionaries/military-units')]);
      setData(detail.data); const person = detail.data.user;
      setForm({ fullName: person.full_name || '', email: person.email || '', rankId: person.rank_id || '', positionId: person.position_id || '', unitId: person.unit_id || '', yearsOfService: person.years_of_service || 0, reprimands: person.reprimands || 0, characteristic: person.characteristic || '' });
      setRole(['admin', 'commander', 'user'].includes(person.role) ? person.role : person.requested_role === 'commander' ? 'commander' : 'user');
      setDicts({ ranks: r.data, positions: p.data, units: u.data });
    } catch (err) { setError(err.response?.data?.error || 'Не удалось загрузить карточку'); } finally { setLoading(false); }
  }, [userId]);
  useEffect(() => { load(); }, [load]);
  const person = data?.user;
  const isSelf = person && (Number(person.id) === Number(me.id) || person.email === me.email);
  const date = value => value ? new Date(value).toLocaleString(lang === 'ky' ? 'ky-KG' : 'ru-RU') : '—';
  const roleName = value => tr(value === 'admin' ? 'Админ' : value === 'commander' ? 'Командир' : value === 'user' ? 'Военнослужащий' : 'Ожидает');
  async function action(url, method, body, message) {
    setBusy(true); setError(''); setNotice('');
    try { await api[method](url, body); setConfirm(''); await load(); await onChanged(); setNotice(message); return true; }
    catch (err) { setError(err.response?.data?.error || 'Ошибка'); return false; } finally { setBusy(false); }
  }
  async function save(event) { event.preventDefault(); if (await action(`/users/${userId}`, 'patch', form, 'Данные сохранены')) setEditing(false); }
  async function resetPassword() {
    setBusy(true); setError('');
    try { const res = await api.post(`/users/${userId}/reset-password`); setTemporaryPassword(res.data.temporaryPassword); setCopied(false); setConfirm(''); await load(); await onChanged(); }
    catch (err) { setError(err.response?.data?.error || 'Не удалось сбросить пароль'); } finally { setBusy(false); }
  }
  async function deleteUser() {
    setBusy(true); setError('');
    try { await api.delete(`/users/${userId}`); await onChanged(); onClose(); }
    catch (err) { setError(err.response?.data?.error || 'Ошибка'); setBusy(false); }
  }
  async function moreActivity() {
    setBusy(true);
    try { const res = await api.get(`/users/${userId}/activity`, { params: { offset: data.activity.nextOffset } }); setData(prev => ({ ...prev, activity: { ...res.data, items: [...prev.activity.items, ...res.data.items] } })); }
    catch (err) { setError(err.response?.data?.error || 'Не удалось загрузить историю'); } finally { setBusy(false); }
  }
  const field = (name, value) => <div className="user-data-item" key={name}><dt>{tr(name)}</dt><dd>{value == null || value === '' ? '—' : value}</dd></div>;
  return <div className="form-overlay"><section className="soldier-form user-detail-modal" role="dialog" aria-modal="true" aria-label={tr('Карточка пользователя')}>
    <div className="user-detail-header"><div><h2>{person?.full_name || tr('Карточка пользователя')}</h2><p>{person?.email}</p></div><button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>{tr('Закрыть')}</button></div>
    {loading ? <p>{tr('Загрузка...')}</p> : person && <>
      {[person.custom_rank,person.custom_position,person.custom_unit].some(Boolean)&&<p className="account-help">{tr('Введено вручную')}: {[person.custom_rank,person.custom_position,person.custom_unit].filter(Boolean).join(' · ')}</p>}
      <div className="tabs">{[['data', 'Данные'], ['tasks', 'Задачи'], ['history', 'История действий'], ['actions', 'Действия']].map(([key, title]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{tr(title)}{key === 'tasks' ? ` (${data.tasks.length})` : ''}</button>)}</div>
      {error && <div className="error-msg" role="alert">{tr(error)}</div>}{notice && <p className="account-success" role="status">{tr(notice)}</p>}
      {tab === 'data' && (editing ? <form onSubmit={save} className="user-edit-form">
        <div className="account-grid"><label>{tr('ФИО')} *<input required maxLength={255} value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} /></label><label>{tr('Логин (email)')} *<input required type="email" autoComplete="off" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
          {[['rankId', 'Звание', dicts.ranks], ['positionId', 'Должность', dicts.positions], ['unitId', 'Часть', dicts.units]].map(([key, label, items]) => <label key={key}>{tr(label)}<select value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}><option value="">—</option>{items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>)}
          {person.soldier_id && <><label>{tr('Выслуга')}<input type="number" min="0" max="150" value={form.yearsOfService} onChange={e => setForm({ ...form, yearsOfService: e.target.value })} /></label><label>{tr('Выговоры')}<input type="number" min="0" max="150" value={form.reprimands} onChange={e => setForm({ ...form, reprimands: e.target.value })} /></label></>}
        </div>{person.soldier_id && <label>{tr('Характеристика')}<textarea rows="4" value={form.characteristic} onChange={e => setForm({ ...form, characteristic: e.target.value })} /></label>}
        <div className="form-actions"><button type="button" className="btn-secondary" onClick={() => { setEditing(false); load(); }}>{tr('Отмена')}</button><button className="btn-primary" disabled={busy}>{tr(busy ? 'Сохранение...' : 'Сохранить изменения')}</button></div>
      </form> : <>
        <div className="user-overview">{person.photo_file && <img src={`/uploads/${person.photo_file}`} alt="" className="user-detail-photo" />}<dl className="account-grid">{field('ФИО', person.full_name)}{field('Логин (email)', person.email)}{field('Роль', roleName(person.role))}{field('Доступ', tr(person.approved ? 'Одобрен' : 'Ожидает одобрения'))}{field('Звание', person.rank_name)}{field('Должность', person.position_name)}{field('Часть', person.unit_name)}{field('Расположение', person.unit_location)}{field('Выслуга', person.years_of_service ?? '—')}{field('Выговоры', person.reprimands ?? '—')}{field('Дата регистрации', date(person.created_at))}{field('Последний вход', date(person.last_login_at))}</dl></div>
        {person.characteristic && <div className="account-section"><h3>{tr('Характеристика')}</h3><p>{person.characteristic}</p></div>}
        <div className="account-section"><h3>{tr('Пароль')}</h3><p className="account-help">{tr('Текущий пароль не отображается. Для восстановления доступа используйте сброс пароля во вкладке «Действия».')}</p></div>
        <div className="form-actions">{person.soldier_id && <Link className="btn-secondary" to={`/soldier/${person.soldier_id}`}>{tr('Открыть личную карточку')}</Link>}<button className="btn-primary" onClick={() => setEditing(true)}>{tr('Редактировать')}</button></div>
      </>)}
      {tab === 'tasks' && <div className="user-task-list">{!data.tasks.length && <div className="empty-state">{tr('Задач нет')}</div>}{data.tasks.map(task => <div className="user-task-item" key={task.id}><div><strong>{task.title}</strong><small>{tr('Срок сдачи')}: {date(task.due_date)}</small></div><span>{tr(task.status === 'новая' ? 'Новая' : task.status === 'в_работе' ? 'В работе' : task.status === 'на_проверке' ? 'На проверке' : task.status === 'выполнена' ? 'Принята' : 'Провалена')}</span></div>)}<div className="form-actions"><Link className="btn-secondary" to="/tasks">{tr('Открыть все задачи')}</Link></div></div>}
      {tab === 'history' && <><p className="account-help">{tr('Действия с задачами и аккаунтом, зарегистрированные системой.')} {data.activity.total}</p><ol className="user-activity-list">{data.activity.items.map(item => <li key={`${item.kind}-${item.id}`}><time>{date(item.created_at)}</time><div><strong>{tr(item.action)}</strong>{item.actor_name && <small>{item.actor_name}</small>}{item.task_title && <p>{item.task_title}</p>}{item.details && <p>{tr(item.details)}</p>}</div></li>)}</ol>{!data.activity.total && <div className="empty-state">{tr('Действий пока нет')}</div>}{data.activity.nextOffset != null && <button className="btn-secondary" onClick={moreActivity} disabled={busy}>{tr('Показать ещё')}</button>}</>}
      {tab === 'actions' && <div className="account-action-list">
        <section className="account-section"><h3>{tr('Роль и доступ')}</h3><div className="account-inline"><select aria-label={tr('Роль')} value={role} disabled={isSelf || busy} onChange={e => setRole(e.target.value)}><option value="user">{tr('Военнослужащий')}</option><option value="commander">{tr('Командир')}</option><option value="admin">{tr('Админ')}</option></select><button className="btn-primary" disabled={isSelf || busy} onClick={() => action(`/users/${userId}/${person.approved ? 'role' : 'approve'}`, 'patch', { role }, 'Доступ обновлён')}>{tr(person.approved ? 'Изменить роль' : 'Одобрить доступ')}</button></div>{isSelf && <p className="account-help">{tr('Свой доступ и роль нельзя понизить.')}</p>}</section>
        <section className="account-section"><h3>{tr('Восстановление доступа')}</h3><p className="account-help">{tr('Временный пароль показывается один раз. При входе пользователь должен заменить его. Старые сеансы будут завершены.')}</p>{isSelf ? <Link className="btn-secondary" to="/change-password">{tr('Изменить свой пароль')}</Link> : <button className="btn-secondary" disabled={busy} onClick={() => setConfirm('password')}>{tr('Сбросить пароль')}</button>}
          {temporaryPassword && <div className="temporary-password" role="status"><label>{tr('Новый временный пароль')}<input type="text" readOnly value={temporaryPassword} autoComplete="off" /></label><button className="btn-secondary" onClick={async () => { try { await navigator.clipboard.writeText(temporaryPassword); setCopied(true); } catch { setNotice('Выделите и скопируйте пароль'); } }}>{tr(copied ? 'Скопировано' : 'Скопировать')}</button><p className="account-help">{tr('После закрытия карточки этот пароль больше не показывается.')}</p></div>}
        </section>
        {!isSelf && <section className="account-section"><h3>{tr('Управление аккаунтом')}</h3><div className="account-inline">{Boolean(person.approved) && <button className="btn-small btn-danger" disabled={busy} onClick={() => setConfirm('revoke')}>{tr('Отозвать доступ')}</button>}<button className="btn-small btn-danger" disabled={busy} onClick={() => setConfirm('delete')}>{tr('Удалить пользователя')}</button></div></section>}
        {confirm && <div className="account-confirm" role="alert"><p>{tr(confirm === 'password' ? 'Создать временный пароль и завершить сеансы пользователя?' : confirm === 'delete' ? 'Удалить пользователя навсегда?' : 'Отозвать доступ у пользователя?')}</p><div className="account-inline"><button className="btn-secondary" disabled={busy} onClick={() => setConfirm('')}>{tr('Отмена')}</button><button className="btn-primary" disabled={busy} onClick={() => confirm === 'password' ? resetPassword() : confirm === 'delete' ? deleteUser() : action(`/users/${userId}/revoke`, 'patch', {}, 'Доступ отозван')}>{tr('Подтвердить')}</button></div></div>}
      </div>}
    </>}
    {!person && !loading && error && <div className="error-msg" role="alert">{tr(error)} <button className="btn-small" onClick={load}>{tr('Повторить')}</button></div>}
  </section></div>;
}
