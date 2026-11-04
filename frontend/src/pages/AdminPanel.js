import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import api from '../api/axios';
import SoldierForm from '../components/SoldierForm';
import UserDetailsModal from '../components/UserDetailsModal';

export default function AdminPanel() {
  const { tr } = useLang();
  const [users, setUsers] = useState([]), [soldiers, setSoldiers] = useState([]);
  const [tab, setTab] = useState('users'), [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [selected, setSelected] = useState(null), [personForm, setPersonForm] = useState(null);
  const load = useCallback(async () => {
    setError('');
    try { const [u, s] = await Promise.all([api.get('/users'), api.get('/soldiers')]); setUsers(u.data); setSoldiers(s.data); }
    catch (err) { setError(err.response?.data?.error || 'Ошибка'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const pending = users.filter(u => !u.approved);
  const query = search.trim().toLocaleLowerCase();
  const rows = (tab === 'personnel' ? soldiers : tab === 'pending' ? pending : users).filter(p => [p.full_name, p.email, p.unit_name, p.military_unit_name, p.rank_name, p.position_name].filter(Boolean).join(' ').toLocaleLowerCase().includes(query));
  const roleName = role => tr(role === 'admin' ? 'Админ' : role === 'commander' ? 'Командир' : role === 'user' ? 'Военнослужащий' : 'Ожидает');
  function accountFor(person) { return tab === 'personnel' ? users.find(u => Number(u.soldier_id) === Number(person.id)) : person; }
  return <main className="container admin-panel">
    <div className="page-title-row"><div><h1>{tr('Панель администратора')}</h1><p className="page-subtitle">{tr('Все пользователи и личный состав')}</p></div><button className="btn-primary" onClick={() => setPersonForm({})}>{tr('Добавить военнослужащего')}</button></div>
    <div className="tabs">{[['users', 'Пользователи', users.length], ['pending', 'Заявки', pending.length], ['personnel', 'Личный состав', soldiers.length]].map(([key, label, count]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{tr(label)} <span>{count}</span></button>)}</div>
    <div className="admin-search"><input className="search-input" aria-label={tr('Поиск пользователей')} placeholder={tr('Поиск по ФИО, логину или части')} value={search} onChange={e => setSearch(e.target.value)} /><span>{tr('Найдено')}: {rows.length}</span></div>
    {error && <div className="error-msg" role="alert">{tr(error)} <button className="btn-small" onClick={load}>{tr('Повторить')}</button></div>}
    {loading ? <p>{tr('Загрузка...')}</p> : <div className="table-wrap admin-users-table"><table><thead><tr><th>{tr('ФИО')}</th><th>{tr('Логин (email)')}</th><th>{tr('Звание и должность')}</th><th>{tr('Часть')}</th><th>{tr('Роль')}</th><th>{tr('Действия')}</th></tr></thead><tbody>
      {!rows.length && <tr><td className="empty-row" colSpan="6">{tr('Нет данных')}</td></tr>}
      {rows.map(person => { const account = accountFor(person); return <tr key={person.id}>
        <td className="name-cell" data-label={tr('ФИО')}><div className="admin-person-name">{person.photo_file ? <img src={`/uploads/${person.photo_file}`} alt="" className="table-photo" /> : <span className="table-photo-ph" aria-hidden="true">{person.full_name?.trim()?.[0] || '—'}</span>}<div>{account ? <button className="user-name-button" onClick={() => setSelected({ id: account.id })}>{person.full_name}</button> : <Link className="soldier-link" to={`/soldier/${person.id}`}>{person.full_name}</Link>}{tab !== 'personnel' && !person.approved && <small className="account-pending">{tr('Ожидает одобрения')}</small>}</div></div></td>
        <td data-label={tr('Логин (email)')}>{account?.email || <span className="muted">{tr('Нет учётной записи')}</span>}</td>
        <td data-label={tr('Звание и должность')}><span>{person.rank_name || '—'}</span><small className="table-secondary">{person.position_name || '—'}</small></td>
        <td data-label={tr('Часть')}>{person.unit_name || person.military_unit_name || '—'}</td>
        <td data-label={tr('Роль')}>{account ? roleName(account.role) : '—'}</td>
        <td className="actions-cell" data-label={tr('Действия')}>{account && <button className="btn-small" onClick={() => setSelected({ id: account.id })}>{tr('Подробнее')}</button>}<button className="btn-small" onClick={() => account ? setSelected({ id: account.id, edit: true }) : setPersonForm(person)}>{tr('Редактировать')}</button></td>
      </tr>; })}
    </tbody></table></div>}
    {selected && <UserDetailsModal key={selected.id} userId={selected.id} initialEdit={selected.edit} onClose={() => setSelected(null)} onChanged={load} />}
    {personForm && <SoldierForm editing={personForm.id ? personForm : null} onCancel={() => setPersonForm(null)} onSaved={() => { setPersonForm(null); load(); }} />}
  </main>;
}
