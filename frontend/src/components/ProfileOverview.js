import {Link} from 'react-router-dom';
import {useLang} from '../context/LanguageContext';
import {useAuth} from '../context/AuthContext';
import PointsSummary from './PointsSummary';
export default function ProfileOverview({profile}){
 const {t,tr}=useLang();const {user}=useAuth();
 return <div className="profile-overview"><PointsSummary />
  <section className="profile-hero"><div className="profile-avatar">{profile.photo_file?<img src={`/uploads/${profile.photo_file}`} alt=""/>:<span>{profile.full_name?.trim().split(/\s+/).slice(0,2).map(n=>n[0]).join('')}</span>}</div><div><span className="profile-eyebrow">{tr('Личный кабинет')}</span><h2>{profile.full_name}</h2><p>{profile.rank_name||'—'} · {profile.position_name||'—'}</p><span className="profile-unit">{profile.military_unit_name||tr('Часть не указана')}</span></div></section>
  <div className="profile-shortcuts"><Link to="/my-tasks"><span>{t('navMyTasks')}</span><small>{tr('Открыть задания и отправить отчёт')}</small><b aria-hidden="true">↗</b></Link><Link to="/reports"><span>{tr('Архив отчётов')}</span><small>{tr('Документы и прошлые версии')}</small><b aria-hidden="true">↗</b></Link>{['admin','commander'].includes(user.role)&&<Link to="/rating"><span>{user.role==='admin'?t('navRating'):t('navUnit')}</span><small>{tr('Результаты за выбранный период')}</small><b aria-hidden="true">↗</b></Link>}</div>
  <section className="profile-progress"><h3>{tr('Мои результаты')}</h3><div><span><b>{profile.completed_tasks||0}</b>{t('completedTasks')}</span><span><b>{profile.overdue_tasks||0}</b>{t('overdueTasks')}</span><span><b>{profile.task_rating??'—'}</b>{t('pointsShort')}</span></div></section>
  <details className="profile-details"><summary>{tr('Личные данные')}</summary><dl><div><dt>{t('fullName')}</dt><dd>{profile.full_name}</dd></div><div><dt>{tr('Логин (email)')}</dt><dd>{user.email||'—'}</dd></div><div><dt>{t('militaryUnit')}</dt><dd>{profile.military_unit_name||'—'}</dd></div><div><dt>{t('unitLocation')}</dt><dd>{profile.military_unit_location||'—'}</dd></div><div><dt>{t('serviceYears')}</dt><dd>{profile.years_of_service||0}</dd></div><div><dt>{t('reprimandsPerYear')}</dt><dd>{profile.reprimands||0}</dd></div></dl>{profile.characteristic&&<p>{profile.characteristic}</p>}</details>
  <details className="profile-details"><summary>{tr('Подробная статистика')}</summary><dl><div><dt>{t('lateTasks')}</dt><dd>{profile.late_tasks||0}</dd></div><div><dt>{t('failedTasks')}</dt><dd>{profile.failed_tasks||0}</dd></div><div><dt>{tr('Начислено')}</dt><dd>+{profile.earned_points||0}</dd></div><div><dt>{tr('Удержано')}</dt><dd>−{profile.penalty_points||0}</dd></div></dl><p className="account-help">{t('taskRatingFormula')}</p></details>
 </div>;
}
