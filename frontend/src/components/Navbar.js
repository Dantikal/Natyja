import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import Brand from './Brand';
import {useEffect,useState} from 'react';
import {useTaskNotifications} from '../context/TaskNotifications';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { lang, toggleLang, t, tr } = useLang();
  const navigate = useNavigate();
  const location = useLocation();
  const {items,read}=useTaskNotifications();
  const [menuOpen,setMenuOpen]=useState(false);
  useEffect(()=>setMenuOpen(false),[location.pathname]);
  const settingsOpen = location.pathname === '/settings';
  const previousPage = location.state?.settingsReturnTo;
  const settingsReturnTo = typeof previousPage === 'string' && previousPage.startsWith('/') && !previousPage.startsWith('//') && !previousPage.startsWith('/settings') ? previousPage : '/profile';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  if (!user) return null;

  const role = user.role;
  const isAdmin = role === 'admin';
  const isCommander = role === 'commander';

  return (
    <nav className="navbar" onKeyDown={e=>{if(e.key==='Escape')setMenuOpen(false);}}>
      <div className="nav-inner">
        <Link to="/profile" className="logo"><Brand /></Link>

        <div className="nav-right">
          <div id="main-navigation" className={`nav-links${menuOpen?' is-open':''}`} onClick={e=>{if(e.target.closest('a'))setMenuOpen(false);}}>
          {/* Профиль — для всех */}
          <Link to="/profile" className={location.pathname === '/profile' ? 'active' : ''}>
            {t('navProfile')}
          </Link>

          {/* Мои задачи — для всех */}
          <Link to="/my-tasks" className={location.pathname === '/my-tasks' ? 'active' : ''}>
            {t('navMyTasks')}
          </Link>

          <Link to="/reports" className={location.pathname === '/reports' ? 'active' : ''}>{tr('Архив отчётов')}</Link>
          <Link to="/assistant" className={location.pathname === '/assistant' ? 'active' : ''}>{lang === 'ky' ? 'ИИ жардамчы' : 'ИИ помощник'}</Link>
          <Link to="/ideas" className={location.pathname === '/ideas' ? 'active' : ''}>{lang==='ky'?'Идеялар':'Идеи'}</Link>

          {/* Командир и админ — видят рейтинг */}
          {(isAdmin || isCommander) && (
            <Link to="/rating" className={location.pathname === '/rating' ? 'active' : ''}>
              {isCommander ? t('navUnit') : t('navRating')}
            </Link>
          )}

          {/* Админ — все задачи */}
          {(isAdmin || isCommander) && (
            <Link to="/tasks" className={location.pathname === '/tasks' ? 'active' : ''}>
              {t('navAllTasks')}
            </Link>
          )}

          {/* Админ — админ-панель */}
          {isAdmin && (
            <Link to="/admin" className={location.pathname === '/admin' ? 'active' : ''}>
              {t('navAdmin')}
            </Link>
          )}

          <button className="mobile-logout" onClick={handleLogout}>{t('navLogout')}</button>
          </div>
          <div className="account-actions">
          <Link to="/my-tasks" className="task-inbox" onClick={read} aria-label={`${tr('Мои задачи')}: ${items.length}`} title={tr('Новые задачи')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M8 4H5v17h14V4h-3M9 3h6v4H9ZM8 12h8M8 16h6"/></svg>{items.length>0&&<span className="task-inbox-count">{items.length>99?'99+':items.length}</span>}</Link>
          <Link to={settingsOpen ? settingsReturnTo : '/settings'} replace={settingsOpen} state={settingsOpen ? null : { settingsReturnTo: location.pathname + location.search + location.hash }} className={`settings-link${settingsOpen ? ' active' : ''}`} aria-label={tr('Настройки')} title={tr('Настройки')}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M19.39,8.94 L19.85,10.47 L22.01,10.05 L22.01,13.95 L19.85,13.53 L19.39,15.06 L18.63,16.47 L20.46,17.70 L17.70,20.46 L16.47,18.63 L15.06,19.39 L13.53,19.85 L13.95,22.01 L10.05,22.01 L10.47,19.85 L8.94,19.39 L7.53,18.63 L6.30,20.46 L3.54,17.70 L5.37,16.47 L4.61,15.06 L4.15,13.53 L1.99,13.95 L1.99,10.05 L4.15,10.47 L4.61,8.94 L5.37,7.53 L3.54,6.30 L6.30,3.54 L7.53,5.37 L8.94,4.61 L10.47,4.15 L10.05,1.99 L13.95,1.99 L13.53,4.15 L15.06,4.61 L16.47,5.37 L17.70,3.54 L20.46,6.30 L18.63,7.53 Z"/><circle cx="12" cy="12" r="3.5"/></svg></Link>
          <button className="lang-btn" onClick={toggleLang} title={t('changeLanguage')}>
            {lang === 'ru' ? 'КЫ' : 'РУ'}
          </button>
          <span className="user-name">{user.fullName}</span>
          <button className="btn-logout" onClick={handleLogout}>{t('navLogout')}</button>
          <button className="mobile-menu-toggle" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={()=>setMenuOpen(v=>!v)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">{menuOpen?<path d="m6 6 12 12M18 6 6 18"/>:<path d="M4 6h16M4 12h16M4 18h16"/>}</svg>{tr(menuOpen?'Закрыть':'Меню')}</button>
          </div>
        </div>
      </div>
    </nav>
  );
}
