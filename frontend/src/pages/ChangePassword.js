import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import Brand from '../components/Brand';

export default function ChangePassword() {
  const { user, changePassword, logout } = useAuth(); const { tr } = useLang(); const navigate = useNavigate();
  const [current, setCurrent] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setError('');
    if (password !== confirm) { setError(tr('Пароли не совпадают')); return; }
    setBusy(true);
    try { await changePassword(current, password); navigate('/profile', { replace: true }); }
    catch (err) { setError(tr(err.response?.data?.error || 'Ошибка')); } finally { setBusy(false); }
  }
  return <main className="container password-page">
    <div className="password-brand"><Brand /></div>
    <form className="account-card" onSubmit={submit}>
      <h1>{tr('Изменить пароль')}</h1>
      {user.mustChangePassword && <p className="account-help">{tr('Замените временный пароль, чтобы продолжить работу.')}</p>}
      <p className="account-help">{user.email}</p>
      <label>{tr(user.mustChangePassword ? 'Временный пароль' : 'Текущий пароль')}<input type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} required /></label>
      <label>{tr('Новый пароль')}<input type="password" autoComplete="new-password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required /><small>{tr('Не менее 8 символов')}</small></label>
      <label>{tr('Повторите новый пароль')}<input type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} required /></label>
      {error && <div className="error-msg" role="alert">{error}</div>}
      <div className="form-actions">{!user.mustChangePassword && <Link className="btn-secondary" to="/profile">{tr('Назад')}</Link>}<button className="btn-primary" disabled={busy}>{tr(busy ? 'Сохранение...' : 'Сохранить пароль')}</button><button className="btn-secondary" type="button" onClick={() => { logout(); navigate('/login'); }}>{tr('Выйти')}</button></div>
    </form>
  </main>;
}
