import { useLang } from "../context/LanguageContext";
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
export default function UnitSummary() {
  const {
    tr
  } = useLang();
  const {
    id
  } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get(`/dictionaries/military-units/${id}/summary`).then(res => setData(res.data)).catch(() => navigate('/')).finally(() => setLoading(false));
  }, [id, navigate]);
  if (loading) return <div className="container"><p>{tr("Загрузка...")}</p></div>;
  if (!data) return <div className="container"><p>{tr("Не найдено")}</p></div>;
  const {
    unit,
    soldiers,
    stats
  } = data;
  return <div className="container">
      <div className="breadcrumbs">
        <Link to="/">{tr("← К списку")}</Link>
      </div>

      {/* Шапка части */}
      <div className="unit-header">
        <div>
          <h1>🏛️ {unit.name}</h1>
          {unit.location && <p className="unit-location">📍 {unit.location}</p>}
        </div>
      </div>

      {/* Статистика */}
      <div className="stats">
        <div className="stat-card">
          <div className="label">{tr("Всего служащих")}</div>
          <div className="value">{stats.total}</div>
        </div>
        <div className="stat-card green">
          <div className="label">{tr("Средняя полезность")}</div>
          <div className="value">{stats.avgUseful}%</div>
        </div>
        <div className="stat-card green">
          <div className="label">{tr("Эффективные (≥75%)")}</div>
          <div className="value">{stats.effective}</div>
        </div>
        <div className="stat-card red">
          <div className="label">{tr("Проблемные (<45%)")}</div>
          <div className="value">{stats.problematic}</div>
        </div>
        <div className="stat-card red">
          <div className="label">{tr("Всего выговоров")}</div>
          <div className="value">{stats.totalReprimands}</div>
        </div>
      </div>

      {/* Средние показатели */}
      <div className="unit-averages">
        <div className="avg-item">
          <span className="avg-label">{tr("Средняя работа")}</span>
          <div className="metric-bar">
            <div className="metric-fill green" style={{
            width: `${stats.avgWorks}%`
          }} />
          </div>
          <span className="avg-value">{stats.avgWorks}%</span>
        </div>
        <div className="avg-item">
          <span className="avg-label">{tr("Среднее перекладывание")}</span>
          <div className="metric-bar">
            <div className="metric-fill red" style={{
            width: `${stats.avgShifts}%`
          }} />
          </div>
          <span className="avg-value">{stats.avgShifts}%</span>
        </div>
      </div>

      {/* Таблица военнослужащих, отсортированная по званию */}
      <h2 className="section-title">{tr("Личный состав (по званию)")}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>{tr("ФИО")}</th>
              <th>{tr("Звание")}</th>
              <th>{tr("Должность")}</th>
              <th>{tr("Выслуга")}</th>
              <th>{tr("Выговоры")}</th>
              <th>{tr("Работает")}</th>
              <th>{tr("опирается на других")}</th>
              <th>{tr("Полезность")}</th>
            </tr>
          </thead>
          <tbody>
            {soldiers.length === 0 ? <tr>
                <td colSpan={9} className="empty-row">{tr("В этой части пока нет военнослужащих")}</td>
              </tr> : soldiers.map(s => <tr key={s.id}>
                  <td className="photo-cell">
                    {s.photo_file ? <img src={`/uploads/${s.photo_file}`} alt="" className="table-photo" onError={e => {
                e.target.style.display = 'none';
              }} /> : <div className="table-photo-ph">🎖️</div>}
                  </td>
                  <td className="name-cell">
                    <Link to={`/soldier/${s.id}`} className="soldier-link">
                      {s.full_name}
                    </Link>
                  </td>
                  <td>{s.rank_name || '—'}</td>
                  <td>{s.position_name || '—'}</td>
                  <td>{s.years_of_service}{tr("лет")}</td>
                  <td className={s.reprimands > 0 ? 'reprimand' : ''}>
                    {s.reprimands}
                  </td>
                  <td>
                    <div className="bar green">
                      <span style={{
                  width: `${s.works_percent}%`
                }}>{s.works_percent}%</span>
                    </div>
                  </td>
                  <td>
                    <div className="bar red">
                      <span style={{
                  width: `${s.shifts_percent}%`
                }}>{s.shifts_percent}%</span>
                    </div>
                  </td>
                  <td>
                    <span className={`useful ${getLevel(s.useful_percent)}`}>
                      {s.useful_percent}%
                    </span>
                  </td>
                </tr>)}
          </tbody>
        </table>
      </div>
    </div>;
}
function getLevel(p) {
  if (p >= 10) return 'high';
  if (p >= 3) return 'mid';
  return 'low';
}
