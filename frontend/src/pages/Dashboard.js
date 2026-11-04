import RatingList from '../components/RatingList';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import SoldierForm from '../components/SoldierForm';
import { ratingPeriods,ratingRange } from '../utils/ratingPeriods';
export default function Dashboard() {
  const [soldiers, setSoldiers] = useState([]);
  const [militaryUnits, setMilitaryUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterUnit, setFilterUnit] = useState('all');
  const [applied,setApplied]=useState(false);
  const [period,setPeriod]=useState('6');
  const [from,setFrom]=useState(()=>ratingRange('6').from),[to,setTo]=useState(()=>ratingRange('6').to),[error,setError]=useState('');
  const { user } = useAuth();
  const { t, tr,lang } = useLang();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if(!isAdmin){setLoading(false);return;}
    api.get('/dictionaries/military-units').then(res=>setMilitaryUnits(res.data)).catch(()=>setError('Ошибка')).finally(()=>setLoading(false));
  }, [isAdmin]);

  async function loadAll() {
    if(!from||!to||from>to){setError('Проверьте период');return;}
    setLoading(true);setError('');
    try {
      const [sRes, uRes] = await Promise.all([
        api.get('/soldiers',{params:{from,to}}),
        isAdmin ? api.get('/dictionaries/military-units') : Promise.resolve({data:[]}),
      ]);
      setSoldiers(sRes.data);
      setMilitaryUnits(uRes.data);
      setApplied(true);
    } catch (err) {
      setError(err.response?.data?.error||'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  function handleFormClose() {
    setShowForm(false);
  }

  function handleFormSaved() {
    handleFormClose();
    loadAll();
  }

  let filtered = soldiers.filter((s) =>
    (s.full_name || '').toLowerCase().includes(search.toLowerCase())
  );

  if (filterUnit !== 'all') {
    const unitObj = militaryUnits.find((u) => u.id === parseInt(filterUnit));
    if (unitObj) {
      filtered = filtered.filter((s) => s.military_unit_name === unitObj.name);
    }
  }

  const ratedSoldiers = filtered.filter((soldier) => soldier.task_rating != null);
  const avgUseful = ratedSoldiers.length
    ? Math.round(ratedSoldiers.reduce((sum, soldier) => sum + Number(soldier.task_rating), 0) / ratedSoldiers.length * 100) / 100
    : 0;

  if (loading) return <div className="container"><p>{t('loading')}</p></div>;

  return (
    <div className={`container rating-page ${isAdmin?'rating-admin':'rating-unit'}`}>
      <div className="page-title-row">
        <h1>{isAdmin?t('rating'):tr('Личный состав моей части')}</h1>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            {t('addSoldier')}
          </button>
        )}
      </div>

      <details className="rating-filter-panel" open={!applied}><summary>{tr('Период')}: {from.split('-').reverse().join('.')} — {to.split('-').reverse().join('.')}</summary>
      <div className="filter-row rating-filters">
        <label>{tr('Период')}<select value={period} onChange={e=>{setPeriod(e.target.value);if(e.target.value!=='custom'){const range=ratingRange(e.target.value);setFrom(range.from);setTo(range.to);}setApplied(false);}}>{ratingPeriods.map(item=><option key={item[0]} value={item[0]}>{item[lang==='ky'?2:1]}</option>)}<option value="custom">{tr('Свой период')}</option></select></label>
        <label>{tr('С даты')}<input type="date" value={from} onChange={e=>{setFrom(e.target.value);setPeriod('custom');setApplied(false);}} /></label>
        <label>{tr('По дату')}<input type="date" value={to} onChange={e=>{setTo(e.target.value);setPeriod('custom');setApplied(false);}} /></label>
        {isAdmin && <label className="filter-label">
          {t('filterUnit')}
          <select
            className="filter-select"
            value={filterUnit}
            onChange={(e) => {setFilterUnit(e.target.value);setApplied(false);}}
          >
            <option value="all">{t('allUnits')}</option>
            {militaryUnits.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </label>}
        <button className="btn-primary" onClick={loadAll}>{tr('Показать рейтинг')}</button>

        {isAdmin && filterUnit !== 'all' && (
          <Link to={`/unit/${filterUnit}`} className="btn-primary btn-view-unit">
            {t('showUnitSummary')}
          </Link>
        )}
      </div>
      </details>
      {error && <div className="error-msg">{tr(error)}</div>}
      {!applied && <div className="empty-state">{tr('Выберите фильтры и нажмите «Показать рейтинг».')}</div>}

      {showForm && (
        <SoldierForm
          onSaved={handleFormSaved}
          onCancel={handleFormClose}
        />
      )}

      {applied && <>

      <details className="rating-explanation"><summary>{tr('Как рассчитывается рейтинг')}</summary><p>{t('taskRatingFormula')}</p></details>

      <div className="rating-summary"><span>{tr('Найдено')}: <b>{filtered.length}</b></span><span>{t('avgUseful')}: <b>{ratedSoldiers.length?avgUseful:'—'}</b></span></div>

      <div className="search-row">
        <input
          type="text"
          placeholder={t('searchByName')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>


      <RatingList soldiers={filtered} />
      </>}
    </div>
  );
}

