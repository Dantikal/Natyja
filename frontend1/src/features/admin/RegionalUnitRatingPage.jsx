import RatingPlanPanel from "./RatingPlanPanel.jsx";
import { T, useLanguage } from "../../i18n.jsx";
import React, { useEffect, useMemo, useState } from "react";

import { getRegionalUnitRatings } from "../../api/dashboard.js";
import { getApiErrorMessage } from "../../api/errors.js";

export const SECTION_LABELS = {
  "thematic-account": "Тематикалык эсеп",
  "lesson-schedule": "Сабактардын жүгүртмөсү",
  "command-thematic-account": "Командирдик даярдоонун тематикалык эсеби",
  "command-lesson-schedule": "Командирдик даярдоонун сабактар жүгүртмөсү",
  "typical-week": "Типтүү жума",
  "combat-training-personnel-journal": "Жеке курамдын даярдык журналы",
  "combat-training-command-journal": "Командирдик даярдык журналы",
  "combat-training-results-observation": "Көзөмөл сабактары",
  "combat-training-results-inspection": "Көзөмөл текшерүү сабактары",
  "combat-training-analysis": "Күжүрмөн даярдоонун талдоосу",
  "combat-training-analysis-regional": "Аскер бөлүгүнүн талдоосу",
  "meetings-thematic-account": "Жыйындардын тематикалык эсеби",
  "meetings-lesson-schedule": "Жыйындардын сабактар жүгүртмөсү",
  "meetings-combat-training-journal": "Жыйындардын даярдык журналы",
  "meetings-observation": "Жыйындардын көзөмөл сабактары",
  "meetings-analysis": "Жыйындардын талдоосу",
  "young-soldier-thematic-account": "Жаш жоокерлердин тематикалык эсеби",
  "young-soldier-lesson-schedule": "Жаш жоокерлердин сабактар жүгүртмөсү",
  "young-soldier-combat-training-journal": "Жаш жоокерлердин даярдык журналы",
  "young-soldier-observation": "Жаш жоокерлердин көзөмөл сабактары",
  "young-soldier-analysis": "Жаш жоокерлердин талдоосу",
  "memo-letter": "Билдирме кат",
};

export const getMedal = (rank) => {
 const place=Number(rank);
 if(![1,2,3].includes(place))return <span className="rank-number">{String(place).padStart(2,'0')}</span>;
 return <span className={`metal-rank metal-rank--${place}`} aria-hidden="true"><svg viewBox="0 0 48 56" fill="none"><path className="metal-rank__ribbon" d="M11 3h10l3 13L27 3h10l-7 22H18L11 3Z"/><path className="metal-rank__face" d="m24 15 6 3 7 1 3 6 4 6-3 7-1 7-7 3-9 5-9-5-7-3-1-7-3-7 4-6 3-6 7-1 6-3Z"/><circle className="metal-rank__ring" cx="24" cy="34" r="12"/><path className="metal-rank__shine" d="M13 31a12 12 0 0 1 14-9"/><text x="24" y="39" textAnchor="middle">{place}</text></svg></span>;
};
export function RatingLeaderBadge({ rank }) {
  const place = Number(rank);
  if (![1, 2, 3].includes(place)) return null;
  return <span className={`rating-leader-badge rating-leader-badge--${place}`} title={`Рейтингде ${place}-орун`}>
    <span aria-hidden="true">{getMedal(place)}</span>
    {place}<T>{"-орун"}</T><T>{place === 1 ? " · Лидер" : ""}</T>
  </span>;
}

const formatDateTime = (value) => value ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Кире элек";
const MONTH_NAMES = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const PIE_COLORS = ["#d8b84b", "#35b96b", "#46a5d8", "#9274d4", "#da765b", "#65c7ba", "#cf6090", "#8ca64b"];

function ScoreMetrics({ item }) {
  return <div className="regional-rating-metrics">
    <span><T>{"Жалпы рейтинг "}</T><strong>{item.score}%</strong></span>
    {item.unitBonus ? <span><T>{"Аскер бөлүгүнүн үстөк пайызы "}</T><strong>+{item.unitBonus}%</strong></span> : null}
    {item.criteriaPenalty ? <span><T>{"Аткарылбаган критерийлер үчүн "}</T><strong>−{item.criteriaPenalty}%</strong></span> : null}
    <span><T>{"Дедлайн "}</T><strong>{item.deadlineScore}%</strong></span>
    <span><T>{"Документтер "}</T><strong>{item.documentScore}%</strong></span>
    <span><T>{"Сапат "}</T><strong>{item.qualityScore ?? 0}%</strong></span>
  </div>;
}

export function RatingChart({ items, type, currentUnitNumber }) {
  if (type === "units") {
    const chartMaximum = 100;
    const ticks = [100, 80, 60, 40, 20, 0];
    return <div className="regional-rating-vertical-chart regional-rating-vertical-chart--score">
      <h2><T>{"Аскер бөлүктөрүнүн графиги"}</T></h2>
      <div className="regional-rating-vertical-chart__scroll">
        <div className="regional-rating-vertical-chart__canvas" style={{ minWidth: `${Math.max(620, items.length * 92)}px` }}>
          <div className="regional-rating-vertical-chart__axis">{ticks.map((tick) => <span key={tick} style={{ top: `${((chartMaximum - tick) / chartMaximum) * 300}px` }}>{tick}%</span>)}</div>
          <div className="regional-rating-vertical-chart__plot">
            <div className="regional-rating-vertical-chart__grid">{ticks.map((tick) => <span key={tick} style={{ top: `${((chartMaximum - tick) / chartMaximum) * 300}px` }} />)}</div>
            <div className="regional-rating-vertical-chart__columns">{items.map((item) => <div className={`regional-rating-vertical-chart__column${String(item.unitNumber) === String(currentUnitNumber) ? " regional-rating-vertical-chart__column--current" : ""}`} key={item.unitNumber}>
              <div className="regional-rating-vertical-chart__bar-area"><span className={`regional-rating-vertical-chart__bar${String(item.unitNumber) === String(currentUnitNumber) ? " regional-rating-vertical-chart__bar--current" : ""}`} style={{ height: `${Math.max(2, ((item.score || 0) / chartMaximum) * 300)}px` }} title={`Аскер бөлүгү ${item.unitNumber}: ${item.score}%`}><i>{item.score}%</i></span></div>
              <strong><RatingLeaderBadge rank={item.rank} /><T>{"Аскер бөлүгү"}</T><br />{item.unitNumber}{String(item.unitNumber) === String(currentUnitNumber) ? <small><T>{"Сиздин аскер бөлүгүңүз"}</T></small> : null}</strong>
            </div>)}</div>
          </div>
        </div>
      </div>
    </div>;
  }

  return <div className="regional-rating-score-chart">
    <div className="regional-rating-score-chart__axis" aria-hidden="true">
      {[0, 20, 40, 60, 80, 100].map((tick) => <span key={tick}>{tick}%</span>)}
    </div>
    {items.map((item) => {
    const label = type === "units" ? `Аскер бөлүгү ${item.unitNumber}` : `${item.outpostName} · ${item.unitNumber}`;
    return <div className="regional-rating-score-chart__row" key={`${item.unitNumber}-${item.outpostName || "unit"}`}>
      <strong><RatingLeaderBadge rank={item.rank} />{label}</strong>
      <div className="regional-rating-score-chart__track"><span style={{ width: `${Math.max(0, Math.min(100, item.score || 0))}%` }}><i>{item.score}%</i></span></div>
      <b>{item.score}%</b>
    </div>;
  })}</div>;
}

function RatingPieChart({ items, type }) {
  const {language}=useLanguage();
  if(!items.some(item=>item.hasRatingData!==false))return <p className="dashboard-state">{language==='ru'?'Недостаточно данных для графика: задайте план и примите документы.':'График үчүн маалымат жетишсиз: план түзүп, документтерди кабыл алыңыз.'}</p>;
  const slices = items.filter(item=>item.hasRatingData!==false).slice(0, 8);
  const total = slices.reduce((sum, item) => sum + Math.max(0, Number(item.score) || 0), 0);
  const circleLength = 2 * Math.PI * 72;
  let offset = 0;
  return <section className="regional-rating-pie">
    <div className="regional-rating-pie__chart" aria-label="Круговая диаграмма рейтинга" role="img">
      <svg viewBox="0 0 180 180">
        <circle className="regional-rating-pie__track" cx="90" cy="90" r="72" />
        {slices.map((item, index) => {
          const value = Math.max(0, Number(item.score) || 0);
          const length = total ? (value / total) * circleLength : 0;
          const sliceOffset = offset;
          offset += length;
          return <circle className="regional-rating-pie__slice" cx="90" cy="90" key={`${item.unitNumber}-${item.outpostName || index}`} r="72" stroke={PIE_COLORS[index % PIE_COLORS.length]} strokeDasharray={`${length} ${circleLength - length}`} strokeDashoffset={-sliceOffset} style={{ "--slice-delay": `${index * 110}ms` }} />;
        })}
      </svg>
      <div className="regional-rating-pie__total"><strong>{total.toFixed(1)}%</strong><span><T>{"жалпы көрсөткүч"}</T></span></div>
    </div>
    <div className="regional-rating-pie__legend">
      {slices.map((item, index) => <div key={`${item.unitNumber}-${item.outpostName || index}`}>
        <i style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
        <span><RatingLeaderBadge rank={item.rank} /><T>{type === "units" ? `${item.unitNumber} аскер бөлүгү` : item.outpostName}</T></span>
        <strong>{item.score}%</strong>
      </div>)}
    </div>
  </section>;
}

function ActivityLog({ actions }) {
  return <div className="regional-rating-actions"><h3><T>{"Акыркы аракеттер"}</T></h3>
    {actions?.length ? actions.map((action, index) => <div className="regional-rating-action" key={`${action.at}-${index}`}>
      <span className={`regional-rating-action__type regional-rating-action__type--${action.type}`}><T>{action.type === "login" ? "Кирүү" : action.onTime ? "Өз убагында" : "Кечикти"}</T></span>
      <div><strong><T>{action.title}</T></strong>{action.sectionId ? <small><T>{SECTION_LABELS[action.sectionId] || action.sectionId}</T><T>{" · дедлайн: айдын "}</T>{action.deadlineDay}<T>{"-күнү"}</T></small> : null}</div>
      <time>{formatDateTime(action.at)}</time>
    </div>) : <p className="dashboard-state"><T>{"Аракеттер азырынча жок."}</T></p>}
  </div>;
}

function AnimatedRatingScore({score}) {
 const [shown,setShown]=useState(0);
 useEffect(()=>{
  const target=Number(score)||0;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){setShown(target);return;}
  let frame;const start=performance.now();
  const tick=now=>{const progress=Math.min(1,(now-start)/850);setShown(Math.round(target*(1-Math.pow(1-progress,3))*10)/10);if(progress<1)frame=requestAnimationFrame(tick)};
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[score]);
 return <>{shown}%</>;
}
function RatingCard({ item, type, onOpen }) {
 const {language}=useLanguage();const copy=(ru,ky)=>language==='ru'?ru:ky;
 const [documentsOpen,setDocumentsOpen]=useState(false);
 const metrics=[[copy('Документы','Документтер'),item.documentScore],[copy('Соблюдение сроков','Мөөнөттөрдү сактоо'),item.deadlineScore],[copy('Качество','Сапат'),item.qualityScore]];
 return <article className={`regional-rating-card rating-clear rating-bars${item.hasRatingData===false?" rating-no-data":""} regional-rating-card--rank-${Math.min(item.rank,4)}`}>
  <div className="rating-clear__top"><span className="rating-clear__place">{item.hasRatingData===false?'—':getMedal(item.rank)} <span>{item.hasRatingData===false?'—':item.rank} {copy('место','орун')}</span></span>
   <div className="rating-clear__name"><h2>{type==='units'?`${copy('Воинская часть','Аскер бөлүгү')} ${item.unitNumber}`:item.outpostName}</h2><p>{type==='units'?`${copy('Документов части','Бөлүктүн документтери')}: ${item.regionalDocuments ?? 0} · ${copy('Документов застав','Заставалардын документтери')}: ${item.outpostDocuments ?? 0}`:`${copy('Воинская часть','Аскер бөлүгү')} ${item.unitNumber} · ${copy('Документов','Документтер')}: ${item.totalDocuments ?? 0}`}</p></div>
   <div className="rating-clear__score"><strong>{item.hasRatingData === false ? copy('Нет данных','Маалымат жок') : <AnimatedRatingScore score={item.score}/>}</strong><span>{copy('Итоговый рейтинг','Жыйынтык рейтинг')}</span></div>
  </div>
  <p className="rating-compact-summary">{item.hasRatingData===false?copy('Недостаточно данных: нет плана с наступившим сроком.','Маалымат жетишсиз: мөөнөтү келген план жок.'):`${copy('Принято','Кабыл алынды')}: ${item.acceptedCount||0} / ${item.plannedCount||0}`}<span>·</span>{copy('Ожидается','Күтүлүүдө')}: {item.waitingCount||0}</p>
  <div className="rating-clear__bottom">{onOpen?<button type="button" onClick={onOpen}>{copy('Открыть подразделения','Бөлүмдөрдү ачуу')} →</button>:null}</div>
  <div className={`rating-clear__details${documentsOpen?' is-open':''}`}><button className="rating-details-toggle" type="button" aria-expanded={documentsOpen} onClick={()=>setDocumentsOpen(open=>!open)}><span>{copy('Как рассчитан рейтинг?','Рейтинг кантип эсептелген?')}</span><span className="rating-details-arrow" aria-hidden="true">⌄</span></button><div className="rating-details-collapse" inert={documentsOpen?undefined:''}><div className="rating-details-inner"><div className="rating-calculation">{metrics.map(([label,value])=><div className="rating-metric-scale" key={label}><p>{label}<strong>{value ?? 0}%</strong></p><div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0,Math.min(100,Number(value)||0))}><i style={{width:`${Math.max(0,Math.min(100,Number(value)||0))}%`}}/></div></div>)}{item.unitBonus?<p>{copy('Надбавка части','Бөлүктүн үстөк пайызы')}<strong>+{item.unitBonus}%</strong></p>:null}{item.criteriaPenalty?<p>{copy('Снижение за невыполненные критерии','Аткарылбаган критерийлер үчүн төмөндөө')}<strong>−{item.criteriaPenalty}%</strong></p>:null}</div><h4 className="rating-documents-heading">{copy('Документы по разделам','Бөлүмдөр боюнча документтер')}</h4>{item.sections?.length?item.sections.map(section=><p className="rating-document-row" key={section.sectionId}><T>{SECTION_LABELS[section.sectionId]||section.sectionId}</T><strong>{section.count}</strong></p>):<p>{copy('Документы ещё не отправлены','Документтер жөнөтүлө элек')}</p>}</div></div></div>
 </article>;
}

export default function RegionalUnitRatingPage() {
  const [planVersion,setPlanVersion]=useState(0);
  const [data, setData] = useState({ units: [], outposts: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [entityType, setEntityType] = useState("units");
  const [displayMode, setDisplayMode] = useState("rating");
  const [ratingPeriod, setRatingPeriod] = useState("all");
  const [periodPage, setPeriodPage] = useState(null);
  const [periodSelectedItem, setPeriodSelectedItem] = useState(null);
  const currentYear = new Date().getFullYear();
  const [ratingYear, setRatingYear] = useState(currentYear);
  const [ratingMonth, setRatingMonth] = useState(new Date().getMonth() + 1);
  const [ratingHalf, setRatingHalf] = useState(new Date().getMonth() < 6 ? 1 : 2);
  const [selectedUnitNumber, setSelectedUnitNumber] = useState(null);
  const selectedUnit = data.units.find((item) => item.unitNumber === selectedUnitNumber);
  const displayedItems = useMemo(() => entityType === "units" ? data.units : data.outposts, [data, entityType]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getRegionalUnitRatings({ period: ratingPeriod, year: ratingYear, month: ratingMonth, half: ratingHalf }).then((items) => { if (mounted) setData(items); })
      .catch((requestError) => { if (mounted) setError(getApiErrorMessage(requestError, "Рейтингди жүктөө мүмкүн болгон жок.")); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [ratingHalf, ratingMonth, ratingPeriod, ratingYear, planVersion]);

  if (periodPage && periodSelectedItem) {
    const { item, type } = periodSelectedItem;
    const title = type === "units" ? `${item.unitNumber} аскер бөлүгү` : item.outpostName;
    return <section className="module-panel regional-rating regional-rating-detail-page">
      <button className="module-back-button" onClick={() => setPeriodSelectedItem(null)} type="button"><T>{"Артка"}</T></button>
      <header className="module-header">
        <div>
          <p className="eyebrow"><T>{periodPage === "month" ? "Айлык рейтинг" : periodPage === "half-year" ? "Жарым жылдык рейтинг" : periodPage === "year" ? "Жылдык рейтинг" : "Бардык жөнөтүлгөн документтер"}</T></p>
          <h1>{title}</h1>
          {type === "outposts" ? <p><T>{"Аскер бөлүгү: "}</T>{item.unitNumber}</p> : null}
        </div>
      </header>
      <div className="regional-rating-detail-criteria">
        <span><T>{"Жалпы рейтинг "}</T><strong>{item.score}%</strong></span>
        <span><T>{"Документтер "}</T><strong>{item.totalDocuments}</strong></span>
        <span><T>{"Өз убагында "}</T><strong>{item.onTimeDocuments}</strong></span>
        {type === "units" ? <><span><T>{"Аскер бөлүгүнөн "}</T><strong>{item.regionalDocuments}</strong></span><span><T>{"Заставалардан "}</T><strong>{item.outpostDocuments}</strong></span></> : null}
        <span><T>{"Колдонуучулар "}</T><strong>{item.userCount}</strong></span>
        <span><T>{"Активдүү колдонуучулар "}</T><strong>{item.activeUserCount}</strong></span>
      </div>
      <h2 className="regional-rating-detail-page__subtitle"><T>{"Рейтингдин критерийлери"}</T></h2>
      <ScoreMetrics item={item} />
      <div className="regional-rating-detail-page__formula">
        <span><T>{"Дедлайн — 50%"}</T></span><span><T>{"Документтердин көлөмү — 30%"}</T></span><span><T>{"Активдүүлүк — 20%"}</T></span><span><T>{"Ар бир аткарылбаган критерий — −10%"}</T></span>{type === "units" ? <span><T>{"Аскер бөлүгүнө — +2%"}</T></span> : null}
      </div>
      <h2 className="regional-rating-detail-page__subtitle"><T>{"Документтердин бөлүмдөрү"}</T></h2>
      <div className="regional-rating-card__sections regional-rating-detail-page__sections">
        {item.sections?.length ? item.sections.map((section) => <span key={section.sectionId}><T>{SECTION_LABELS[section.sectionId] || section.sectionId}</T>: <strong>{section.count}</strong></span>) : <span><T>{"Бул мезгилде документтер жок."}</T></span>}
      </div>
      <ActivityLog actions={item.actions} />
    </section>;
  }

  if (periodPage) return <section className="module-panel regional-rating regional-rating-chart-page">
    <button className="module-back-button" onClick={() => setPeriodPage(null)} type="button"><T>{"Артка"}</T></button>
    <header className="module-header">
      <div>
        <p className="eyebrow"><T>{"Рейтингдин аналитикасы"}</T></p>
        <h1><T>{periodPage === "month" ? "Айлык рейтинг" : periodPage === "half-year" ? "Жарым жылдык рейтинг" : periodPage === "year" ? "Жылдык рейтинг" : "Жалпы рейтинг"}</T></h1>
        <p><T>{"Ар бир тилке жалпы рейтингди көрсөтөт. Тизмени аскер бөлүктөрү же заставалар боюнча ачыңыз."}</T></p>
      </div>
    </header>
    <RatingPlanPanel onChange={()=>{setPlanVersion(v=>v+1);window.dispatchEvent(new Event("munara:ratings-changed"));}}/>
    <div className="regional-rating-controls">
      <button className={entityType === "units" ? "is-active" : ""} onClick={() => setEntityType("units")} type="button"><T>{"Аскер бөлүктөрү"}</T></button>
      <button className={entityType === "outposts" ? "is-active" : ""} onClick={() => setEntityType("outposts")} type="button"><T>{"Заставалар"}</T></button>
    </div>
    <div className="regional-rating-period-picker">
      {periodPage !== "all" ? <label><T>{"Жыл"}</T><select onChange={(event) => setRatingYear(Number(event.target.value))} value={ratingYear}>{Array.from({ length: 6 }, (_, index) => currentYear - index).map((year) => <option key={year} value={year}>{year}</option>)}</select></label> : null}
      {periodPage === "month" ? <label><T>{"Ай"}</T><select onChange={(event) => setRatingMonth(Number(event.target.value))} value={ratingMonth}>{MONTH_NAMES.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></label> : null}
      {periodPage === "half-year" ? <label><T>{"Жарым жылдык"}</T><select onChange={(event) => setRatingHalf(Number(event.target.value))} value={ratingHalf}><option value={1}><T>{"I жарым жылдык"}</T></option><option value={2}><T>{"II жарым жылдык"}</T></option></select></label> : null}
    </div>
    {error ? <p className="dashboard-error"><T>{error}</T></p> : null}
    {loading ? <p className="dashboard-state"><T>{"Рейтинг жүктөлүүдө..."}</T></p> : null}
    {!loading && !error && displayedItems.length > 0 ? <>
      <RatingPieChart items={displayedItems} type={entityType} />
      <h2 className="regional-rating-chart-page__list-title"><T>{"Бардык "}</T><T>{entityType === "units" ? "аскер бөлүктөрү" : "заставалар"}</T></h2>
      <div className="regional-rating__list">
        {displayedItems.map((item) => <RatingCard item={item} key={`${item.unitNumber}-${item.outpostName || "unit"}`} onOpen={() => setPeriodSelectedItem({ item, type: entityType })} type={entityType} />)}
      </div>
    </> : null}
    {!loading && !error && !displayedItems.length ? <p className="dashboard-state"><T>{"Бул мезгил үчүн маалымат азырынча жок."}</T></p> : null}
  </section>;

  if (selectedUnit) return <section className="module-panel regional-rating">
    <button className="module-back-button" onClick={() => { setSelectedUnitNumber(null); setDisplayMode("rating"); }} type="button"><T>{"Артка"}</T></button>
    <header className="module-header"><div><p className="eyebrow"><T>{"Аскер бөлүгүнүн толук маалыматы"}</T></p><h1><T>{"Аскер бөлүгү "}</T>{selectedUnit.unitNumber}</h1><p><T>{"Акыркы кирүү: "}</T>{formatDateTime(selectedUnit.lastSeen)}</p></div>
      <button onClick={() => setDisplayMode((mode) => mode === "detail-chart" ? "rating" : "detail-chart")} type="button"><T>{displayMode === "detail-chart" ? "Заставалар" : "Заставалардын графиги"}</T></button>
    </header>
    <ScoreMetrics item={selectedUnit} />
    {displayMode === "detail-chart" ? <RatingChart items={selectedUnit.outposts || []} type="outposts" /> : <div className="regional-rating__list">{(selectedUnit.outposts || []).map((outpost) => <RatingCard item={outpost} key={outpost.outpostName} type="outposts" />)}</div>}
    <ActivityLog actions={selectedUnit.actions} />
  </section>;

  return <section className="module-panel regional-rating">
    <header className="module-header"><div><p className="eyebrow"><T>{"Милдеттүү план, кабыл алынган документтер жана мөөнөттөр"}</T></p><h1><T>{"Жалпы рейтинг"}</T></h1><p><T>{"Рейтинг милдеттүү план боюнча эсептелет: аткаруу — 60%, мөөнөт — 30%, сапат — 10%."}</T></p></div></header>
    <RatingPlanPanel onChange={()=>{setPlanVersion(v=>v+1);window.dispatchEvent(new Event("munara:ratings-changed"));}}/>
    <div className="regional-rating-controls">
      <button className={ratingPeriod === "all" ? "is-active" : ""} onClick={() => { setRatingPeriod("all"); setPeriodSelectedItem(null); setPeriodPage("all"); setDisplayMode("rating"); }} type="button"><T>{"Бардык рейтинг"}</T></button>
      <button className={ratingPeriod === "month" ? "is-active" : ""} onClick={() => { setRatingPeriod("month"); setPeriodSelectedItem(null); setPeriodPage("month"); setDisplayMode("rating"); }} type="button"><T>{"Айлык рейтинг"}</T></button>
      <button className={ratingPeriod === "half-year" ? "is-active" : ""} onClick={() => { setRatingPeriod("half-year"); setPeriodSelectedItem(null); setPeriodPage("half-year"); setDisplayMode("rating"); }} type="button"><T>{"Жарым жылдык рейтинг"}</T></button>
      <button className={ratingPeriod === "year" ? "is-active" : ""} onClick={() => { setRatingPeriod("year"); setPeriodSelectedItem(null); setPeriodPage("year"); setDisplayMode("rating"); }} type="button"><T>{"Жылдык рейтинг"}</T></button>
      <button className={entityType === "units" ? "is-active" : ""} onClick={() => { setEntityType("units"); setDisplayMode("rating"); }} type="button"><T>{"Аскер бөлүктөрүнүн жалпы рейтинги жана графиги"}</T></button>
      <button className={entityType === "outposts" ? "is-active" : ""} onClick={() => { setEntityType("outposts"); setDisplayMode("rating"); }} type="button"><T>{"Заставалардын жалпы рейтинги жана графиги"}</T></button>
      <button disabled={!displayedItems.length} onClick={() => setDisplayMode((mode) => mode === "chart" ? "rating" : "chart")} type="button"><T>{displayMode === "chart" ? "Рейтингге кайтуу" : entityType === "units" ? "Аскер бөлүктөрүнүн графиги" : "Заставалардын графиги"}</T></button>
    </div>
    {error ? <p className="dashboard-error"><T>{error}</T></p> : null}
    {loading ? <p className="dashboard-state"><T>{"Рейтинг жүктөлүүдө..."}</T></p> : null}
    {!loading && !error && !displayedItems.length ? <p className="dashboard-state"><T>{"Рейтинг үчүн маалымат азырынча жок."}</T></p> : null}
    {!loading && displayedItems.length > 0 && displayMode === "chart" ? <RatingChart items={displayedItems} type={entityType} /> : null}
    {!loading && displayedItems.length > 0 && displayMode !== "chart" ? <div className="regional-rating__list">{displayedItems.map((item) => <RatingCard item={item} key={`${item.unitNumber}-${item.outpostName || "unit"}`} onOpen={entityType === "units" ? () => setSelectedUnitNumber(item.unitNumber) : undefined} type={entityType} />)}</div> : null}
  </section>;
}
