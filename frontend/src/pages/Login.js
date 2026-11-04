import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import Brand from '../components/Brand';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { lang, toggleLang, t } = useLang();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      navigate(data.mustChangePassword ? '/change-password' : '/profile');
    } catch (err) {
      if (err.response?.data?.error === 'pending') {
        setError(t('errorPending'));
      } else {
        setError(err.response?.data?.error || t('errorLogin'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-lang-switch">
          <button onClick={toggleLang}>{lang === 'ru' ? 'КЫ' : 'РУ'}</button>
        </div>
        <div className="auth-brand"><Brand large /></div>
        <h1>{t('loginTitle')}</h1>
        <p className="auth-subtitle">{t('loginSubtitle')}</p>

        <form onSubmit={handleSubmit}>
          <label>
            {t('email')}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>

          <label>
            {t('password')}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && <div className="error-msg" role="alert">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? t('loggingIn') : t('loginBtn')}
          </button>
        </form>

        <p className="auth-footer">
          {t('noAccount')} <Link to="/register">{t('register')}</Link>
        </p>
      </div>
    </div>
  );
}
