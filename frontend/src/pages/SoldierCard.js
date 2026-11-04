import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { useLang } from '../context/LanguageContext';

export default function SoldierCard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLang();
  const [soldier, setSoldier] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/soldiers/${id}`)
      .then((res) => setSoldier(res.data))
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) return <div className="container"><p>{t('loading')}</p></div>;
  if (!soldier) return <div className="container"><p>{t('noData')}</p></div>;

  const level = soldier.task_rating == null ? 'unrated' : soldier.task_rating >= 10 ? 'high' : soldier.task_rating >= 3 ? 'mid' : 'low';
  const levelText = soldier.task_rating == null ? t('noTaskRating') : soldier.task_rating >= 10 ? t('highRating') : soldier.task_rating >= 3 ? t('midRating') : t('lowRating');

  return (
    <div className="container">
      <div className="breadcrumbs">
        <Link to="/">{t('backToList')}</Link>
      </div>

      <div className="soldier-card-page">
        <div className="soldier-photo-block">
          {soldier.photo_file ? (
            <img
              src={`/uploads/${soldier.photo_file}`}
              alt={soldier.full_name}
              className="soldier-photo"
              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
            />
          ) : null}
          <div className="photo-placeholder" style={{ display: soldier.photo_file ? 'none' : 'flex' }}>
            
          </div>
          <div className={`badge-level badge-${level}`}>
            {levelText}
          </div>
        </div>

        <div className="soldier-info-block">
          <h1>{soldier.full_name}</h1>
          <div className="rank-position">
            <b>{soldier.rank_name || '—'}</b> · {soldier.position_name || '—'}
          </div>

          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">{t('militaryUnit')}</span>
              <span className="info-value">{soldier.military_unit_name || '—'}</span>
            </div>
            {soldier.military_unit_location && (
              <div className="info-item">
                <span className="info-label">{t('unitLocation')}</span>
                <span className="info-value">{soldier.military_unit_location}</span>
              </div>
            )}
            <div className="info-item">
              <span className="info-label">{t('serviceYears')}</span>
              <span className="info-value">{soldier.years_of_service} {t('years')}</span>
            </div>
            <div className="info-item">
              <span className="info-label">{t('reprimandsPerYear')}</span>
              <span className={`info-value ${soldier.reprimands > 0 ? 'reprimand' : ''}`}>
                {soldier.reprimands}
              </span>
            </div>
          </div>

          <p className="task-rating-formula">{t('taskRatingFormula')}</p>
          <div className="stats">
            <div className="stat-card"><div className="label">{t('completedTasks')}</div><div className="value">{soldier.completed_tasks || 0}</div></div>
            <div className="stat-card"><div className="label">{t('lateTasks')}</div><div className="value">{soldier.late_tasks || 0}</div></div>
            <div className="stat-card red"><div className="label">{t('failedTasks')}</div><div className="value">{soldier.failed_tasks || 0}</div></div>
            <div className="stat-card red"><div className="label">{t('overdueTasks')}</div><div className="value">{soldier.overdue_tasks || 0}</div></div>
          </div>
          <div className="metrics">
            <div className="metric metric-total">
              <div className="metric-label">{t('taskRating')}</div>
              <div className={`metric-total-value ${level}`}>
                {soldier.task_rating == null ? t('noTaskRating') : `${soldier.task_rating} ${t('pointsShort')}`}
              </div>
            </div>
          </div>

          {soldier.characteristic && (
            <div className="characteristic-block">
              <h3>{t('characteristicTitle')}</h3>
              <p>{soldier.characteristic}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
