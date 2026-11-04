import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import HelpGuide from '../components/HelpGuide';
export default function Help() {
  const { lang, toggleLang } = useLang();
  const { user } = useAuth();
  const ky = lang === 'ky';
  return <>{user && <Navbar />}<main className="container help-page">
    <div className="help-page-heading"><h1>{ky ? 'Сайтты колдонуу боюнча жардам' : 'Помощь пользователю'}</h1><div className="help-page-actions">
      <button type="button" className="btn-secondary" onClick={toggleLang}>{ky ? 'Русский' : 'Кыргызча'}</button>
      <Link className="btn-secondary" to={user ? '/profile' : '/login'}>{ky ? 'Сайтка кайтуу' : 'Вернуться на сайт'}</Link>
    </div></div><HelpGuide />
  </main></>;
}
