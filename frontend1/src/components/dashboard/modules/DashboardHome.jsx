import { T, useLanguage } from "../../../i18n.jsx";
import { isTrainingUnit, TRAINING_UNIT_MODULES, trainingContactLabel } from "../../../data/unitTypes.js";
import React, { useEffect, useState, useId } from "react";
import { canShowModule } from "../../../data/unitTypes.js";

import {
  getThematicAccountSubmissions,
  hideThematicAccountSubmission,
} from "../../../api/dashboard.js";
import { getApiErrorMessage } from "../../../api/errors.js";
import ModuleBanners from "./ModuleBanners.jsx";

function WelcomeDateTime(){
 const {language}=useLanguage();const [now,setNow]=useState(()=>new Date());const [expanded,setExpanded]=useState(false);
 useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(timer)},[]);
 const locale=language==='ru'?'ru-RU':'ky-KG';
 return <div className="welcome-date-time"><button type="button" className="welcome-date-toggle" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}><time dateTime={now.toISOString()}>{new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric'}).format(now)}</time><span aria-hidden="true">{expanded?'⌃':'⌄'}</span></button><time className="welcome-clock" aria-label={language==='ru'?'Текущее время':'Учурдагы убакыт'}>{new Intl.DateTimeFormat(locale,{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(now)}</time><div className={`welcome-full-date${expanded?' is-open':''}`}><div>{new Intl.DateTimeFormat(locale,{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(now)}</div></div></div>;
}

function WelcomeShield(){
 const id=useId().replace(/:/g,'');
 return <div className="welcome-shield" aria-hidden="true"><div className="welcome-shield__rotor"><svg viewBox="0 0 120 120" fill="none">
  <defs><linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f2e4b8"/><stop offset=".25" stopColor="#b59b60"/><stop offset=".48" stopColor="#fff0bf"/><stop offset=".72" stopColor="#796338"/><stop offset="1" stopColor="#ccb47b"/></linearGradient><linearGradient id={`${id}-core`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#527868"/><stop offset=".5" stopColor="#183d30"/><stop offset="1" stopColor="#0c211a"/></linearGradient><clipPath id={`${id}-clip`}><path d="M60 8 103 25v32c0 27-22 47-43 56-21-9-43-29-43-56V25Z"/></clipPath></defs>
  <path d="M60 12 103 29v32c0 27-22 47-43 56-21-9-43-29-43-56V29Z" fill="#594c30"/>
  <path d="M60 8 103 25v32c0 27-22 47-43 56-21-9-43-29-43-56V25Z" fill={`url(#${id}-rim)`} stroke="#e9d9ad" strokeWidth="1"/>
  <path d="M60 20 92 33v24c0 20-16 36-32 44-16-8-32-24-32-44V33Z" fill={`url(#${id}-core)`} stroke="#9c8955"/>
  <path d="M60 23v75c17-10 29-24 29-41V35Z" fill="#ffffff08"/>
  <path d="m42 59 12 12 25-29" stroke="#071a13" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" transform="translate(0 2)"/>
  <path d="m42 59 12 12 25-29" stroke={`url(#${id}-rim)`} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
  <g clipPath={`url(#${id}-clip)`}><path className="welcome-shield__glint" d="M-50-10h22l65 150H15Z" fill="white"/></g>
 </svg></div></div>;
}

const sectionLabels = {
  "combat-training-analysis": "Күжүрмөн даярдоонун талдоосу",
  "combat-training-analysis-regional": "Күжүрмөн даярдоонун талдоосу",
  "combat-training-command-journal": "Командирдик даярдоону каттоо журналы",
  "combat-training-personnel-journal": "Күжүрмөн даярдоону каттоо журналы",
  "combat-training-results-inspection": "Көзөмөл текшерүү сабактары",
  "combat-training-results-observation": "Көзөмөл сабактары",
  "command-lesson-schedule": "Командирдик даярдоонун сабактар жүгүртмөсү",
  "command-thematic-account": "Командирдик даярдоонун тематикалык эсеби",
  "lesson-schedule": "Сабактардын жүгүртмөсү",
  "meetings-analysis": "Жыйындардын талдоосу",
  "meetings-combat-training-journal": "Жыйындардын каттоо журналы",
  "meetings-lesson-schedule": "Жыйындардын сабактар жүгүртмөсү",
  "meetings-observation": "Жыйындардын көзөмөл сабактары",
  "meetings-thematic-account": "Жыйындардын тематикалык эсеби",
  "memo-letter": "Билдирме кат",
  "thematic-account": "Сабактардын тематикалык эсеби",
  "typical-week": "Типтүү жума",
  "young-soldier-analysis": "Жаш жоокерлерди даярдоонун талдоосу",
  "young-soldier-combat-training-journal": "Жаш жоокерлерди даярдоо журналы",
  "young-soldier-lesson-schedule": "Жаш жоокерлердин сабактар жүгүртмөсү",
  "young-soldier-observation": "Жаш жоокерлердин көзөмөл сабактары",
  "young-soldier-thematic-account": "Жаш жоокерлердин тематикалык эсеби",
};

const commonLinks = [
  { id: "library", icon: "▤", label: "Сабактардын тематикасынын эсеби" },
  { id: "combatTrainingJournal", icon: "▦", label: "Күжүрмөн даярдоону каттоо журналы" },
  { id: "combatTrainingResults", icon: "✓", label: "Күжүрмөн даярдоонун жыйынтыктары" },
  { id: "combatTrainingAnalytics", icon: "⌁", label: "Күжүрмөн даярдоонун талдоолору" },
  { id: "smr", icon: "◇", label: "Усулдук колдонмолор" },
  { id: "combatTrainingPlan", icon: "□", label: "Пландалган иш-чаралар" },
  { id: "combatTrainingReport", icon: "◫", label: "Күжүрмөн даярдоонун маалыматтары" },
  { id: "contactAdmin", icon: "✉", label: "Байланыш" },
  { id: "memoLetter", icon: "✎", label: "Билдирме кат" },
];

const adminLinks = [
  ...commonLinks.slice(0, 3),
  { id: "meetings", icon: "◉", label: "Жыйындар" },
  { id: "youngSoldierTrainingCourse", icon: "★", label: "Жаш жоокерлерди даярдоо курсу" },
  ...commonLinks.slice(3),
  { id: "users", icon: "♙", label: "Колдонуучулар" },
  { id: "requests", icon: "⌛", label: "Өтүнмөлөр" },
  { id: "submissionEditRequests", icon: "☑", label: "Уруксат сурамдары" },
  { id: "documents", icon: "▧", label: "Документтер" },
  { id: "regionalUnitRating", icon: "♜", label: "Рейтинг" },
];

const regionalLinks = [
  ...commonLinks.slice(0, 3),
  { id: "meetings", icon: "◉", label: "Жыйындар" },
  { id: "youngSoldierTrainingCourse", icon: "★", label: "Жаш жоокерлерди даярдоо курсу" },
  ...commonLinks.slice(3),
  { id: "regionalUsers", icon: "♙", label: "Колдонуучулар" },
  { id: "outpostRating", icon: "♜", label: "Заставалардын рейтинги" },
];

const quickIconTypes = {
  library: "book", combatTrainingJournal: "journal", combatTrainingResults: "check",
  combatTrainingAnalytics: "chart", smr: "shield", combatTrainingPlan: "calendar",
  combatTrainingReport: "report", contactAdmin: "message", memoLetter: "letter",
  meetings: "meeting", youngSoldierTrainingCourse: "training", users: "users",
  regionalUsers: "users", requests: "request", submissionEditRequests: "edit",
  documents: "documents", regionalUnitRating: "rating", outpostRating: "rating",
};

function QuickAccessIcon({ sectionId }) {
  const type = quickIconTypes[sectionId] || "grid";
  const paths = {
    book: <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H12v17H7.5A3.5 3.5 0 0 0 4 22Z"/><path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H12v17h4.5A3.5 3.5 0 0 1 20 22Z"/></>,
    journal: <><path d="M5 3h14v18H5z"/><path d="M9 3v18M12 8h4M12 12h4M12 16h4"/></>,
    check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16.5 8"/></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    shield: <><path d="M12 2 20 5v6c0 5.2-3.3 9-8 11-4.7-2-8-5.8-8-11V5Z"/><path d="m9 12 2 2 4-5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 10h18M8 14h2M14 14h2M8 18h2"/></>,
    report: <><path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5M9 17v-3M12 17v-6M15 17v-8"/></>,
    message: <><path d="M4 4h16v13H9l-5 4Z"/><path d="M8 9h8M8 13h5"/></>,
    letter: <><path d="M3 5h18v14H3z"/><path d="m3 6 9 7 9-7"/></>,
    meeting: <><circle cx="8" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M2 20c.4-4 2.4-6 6-6s5.6 2 6 6M13 15c1-.7 2.3-1 4-1 3.2 0 4.8 2 5 6"/></>,
    training: <><path d="m3 9 9-5 9 5-9 5Z"/><path d="M7 12v5c3 2 7 2 10 0v-5M21 9v7"/></>,
    users: <><circle cx="9" cy="8" r="4"/><path d="M2 21c.5-5 2.8-7 7-7s6.5 2 7 7M16 5.5a3.5 3.5 0 0 1 0 6.5M17 15c3 .3 4.6 2.2 5 6"/></>,
    request: <><path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h3"/></>,
    edit: <><path d="M4 20h4L20 8l-4-4L4 16Z"/><path d="m14 6 4 4"/></>,
    documents: <><path d="M5 3h10l4 4v14H5z"/><path d="M14 3v5h5M8 12h8M8 16h8"/></>,
    rating: <><path d="M8 21h8M12 17v4M7 4h10v4c0 4-2 7-5 9-3-2-5-5-5-9Z"/><path d="M7 6H3c0 4 1.5 6 5 6M17 6h4c0 4-1.5 6-5 6"/></>,
    grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[type]}</svg>;
}

const formatMonth = (value) => {
  const [year, month] = String(value || "").split("-").map(Number);
  const date = year && month ? new Date(year, month - 1, 1) : new Date();
  const label = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export default function DashboardHome({ data, modules, onNavigate, user }) {
  const { language } = useLanguage();
  const copy = (ru, ky) => language === 'ru' ? ru : ky;
  const [sentDocuments, setSentDocuments] = useState([]);
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false);
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState(null);
  const [documentsError, setDocumentsError] = useState("");
  const [monthlyCount, setMonthlyCount] = useState(data?.sentDocuments || 0);
  const role = user?.role;
  const links = isTrainingUnit(user?.unit_type)
    ? [...regionalLinks, { id: "shootingStatements", label: "Ок атуунун ведомосттору" }].filter((item) => TRAINING_UNIT_MODULES.includes(item.id))
    : role === "admin" ? adminLinks : role === "regional" ? regionalLinks : commonLinks;
  const contactLabel = trainingContactLabel(user) || (role === "outpost"
    ? "Аскер бөлүк менен байланыш"
    : "Колдонуучулар менен байланыш");
  const visibleLinks = links
    .filter((item) => canShowModule(user, item.id))
    .filter((item) => item.id !== "combatTrainingJournal" || modules?.combatTrainingJournal)
    .map((item) => (item.id === "contactAdmin" ? { ...item, label: contactLabel } : isTrainingUnit(user?.unit_type) && item.id === "outpostRating" ? { ...item, label: "Рейтинг" } : item));
  const notifications = Array.isArray(data?.notifications) ? data.notifications : [];

  useEffect(() => {
    setMonthlyCount(data?.sentDocuments || 0);
  }, [data?.sentDocuments]);

  const openSentDocuments = async () => {
    setIsDocumentsOpen(true);
    setIsDocumentsLoading(true);
    setDocumentsError("");
    try {
      const items = await getThematicAccountSubmissions(undefined, [], user?.id);
      setSentDocuments(
        (Array.isArray(items) ? items : [])
          .filter((item) => String(item.senderId) === String(user?.id))
          .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
      );
    } catch (requestError) {
      setDocumentsError(
        getApiErrorMessage(requestError, "Жөнөтүлгөн документтерди жүктөө мүмкүн болгон жок.")
      );
    } finally {
      setIsDocumentsLoading(false);
    }
  };

  const removeSentDocument = async (document) => {
    if (!window.confirm(`«${document.documentTitle || "Документ"}» документин өз тизмеңизден өчүрөсүзбү? Документ алуучуларда сакталат.`)) {
      return;
    }
    setDeletingDocumentId(document.id);
    setDocumentsError("");
    try {
      await hideThematicAccountSubmission(document.id);
      setSentDocuments((items) => items.filter((item) => item.id !== document.id));

      const documentDate = new Date(document.createdAt);
      const [currentYear, currentMonth] = String(data?.month || "").split("-").map(Number);
      if (
        currentYear &&
        currentMonth &&
        documentDate.getFullYear() === currentYear &&
        documentDate.getMonth() + 1 === currentMonth
      ) {
        setMonthlyCount((count) => Math.max(0, count - 1));
      }
    } catch (requestError) {
      setDocumentsError(
        getApiErrorMessage(requestError, "Документти өчүрүү мүмкүн болгон жок.")
      );
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const notificationTotal = notifications.reduce((total, item) => total + Number(item.count || 0), 0);
  const linkGroups = [
    { title: copy('Подготовка', 'Даярдоо'), ids: ['library','combatTrainingJournal','combatTrainingResults','meetings','youngSoldierTrainingCourse','combatTrainingAnalytics'] },
    { title: copy('Материалы и связь', 'Материалдар жана байланыш'), ids: ['smr','combatTrainingPlan','combatTrainingReport','contactAdmin','memoLetter'] },
    { title: copy('Управление', 'Башкаруу'), ids: ['users','regionalUsers','requests','submissionEditRequests','documents','regionalUnitRating','outpostRating'] },
  ];
  return (
    <div className="dashboard-home">
      <header className="home-page-intro home-welcome">
        <div className="home-welcome__body"><span>{copy('ЛИЧНЫЙ РАБОЧИЙ КАБИНЕТ', 'ЖЕКЕ ИШ БӨЛМӨСҮ')}</span>
          <h1 className="welcome-readable-title"><span>{copy('Добро пожаловать', 'Кош келиңиз')}</span>{user?.full_name && <strong>{user.full_name}</strong>}</h1>
          <p>{[role === 'admin' ? copy('Администратор платформы', 'Платформанын администратору') : null, user?.region ? `${copy('Воинская часть', 'Аскер бөлүгү')} ${user.region}` : null, user?.outpost_name].filter(Boolean).join(' · ') || 'КҮЖҮРМӨН АСКЕР'}</p>
          <div className={`home-welcome__status${role === 'admin' && notificationTotal ? ' has-updates' : ''}`}><i aria-hidden="true"/>{role === 'admin' ? (notificationTotal ? copy(`Требуют внимания: ${notificationTotal} новых событий`, `Көңүл бурууну талап кылат: ${notificationTotal} жаңы окуя`) : copy('Новых уведомлений нет. Всё под контролем.', 'Жаңы билдирүүлөр жок. Баары көзөмөлдө.')) : copy('Ваши документы и связь с подразделениями — ниже.', 'Документтериңиз жана бөлүмдөр менен байланыш төмөндө.')}</div>
        </div>
        <div className="home-welcome__side"><WelcomeDateTime/><WelcomeShield/></div>
      </header>
      <ModuleBanners moduleKey="home" user={user} />

      {role === "admin" ? (
        <section className="dashboard-home__section">
          <div className="dashboard-home__heading">
            <div>
              <span><T>{"Башкаруу панели"}</T></span>
              <h1><T>{"Билдирүүлөр"}</T></h1>
            </div>
            <strong className={`dashboard-home__notification-total${notificationTotal ? " has-updates" : " is-empty"}`}>
              {notificationTotal}
            </strong>
          </div>
          <div className="dashboard-home__notifications">
            {notifications.map((item) => (
              <button className={Number(item.count) > 0 ? "has-updates" : "is-empty"} data-motion={item.id} key={item.id} onClick={() => onNavigate?.(item.target)} type="button">
                <span className="dashboard-home__notification-icon">!</span>
                <span><T>{item.label}</T></span>
                <strong>{item.count}</strong>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <button className="dashboard-home__monthly-stat" onClick={openSentDocuments} type="button">
          <div className="dashboard-home__monthly-icon">▧</div>
          <div>
            <span>{formatMonth(data?.month)}</span>
            <h1><T>{"Жөнөтүлгөн документтер"}</T></h1>
          </div>
          <strong>{monthlyCount}</strong>
        </button>
      )}

      <section className="dashboard-home__section">
        <div className="dashboard-home__heading">
          <div>
            <span><T>{"Навигация"}</T></span>
            <h2><T>{"Тез жетүү"}</T></h2>
          </div>
        </div>
        {linkGroups.map(group => {
          const links = visibleLinks.filter(item => group.ids.includes(item.id));
          return links.length ? <div className="home-link-group" key={group.title}>
            <h3>{group.title}</h3>
            <div className="dashboard-home__quick-grid">
              {links.map(item => <button data-motion={item.id} key={item.id} onClick={() => onNavigate?.(item.id)} type="button">
                <span className="dashboard-home__quick-icon"><QuickAccessIcon sectionId={item.id}/></span>
                <span><T>{item.label}</T></span><small aria-hidden="true">→</small>
              </button>)}
            </div>
          </div> : null;
        })}
      </section>

      {isDocumentsOpen ? (
        <div className="dashboard-home-documents" role="dialog" aria-modal="true" aria-labelledby="sent-documents-title">
          <section className="dashboard-home-documents__panel">
            <header>
              <div>
                <span><T>{"Бардыгы: "}</T>{sentDocuments.length}</span>
                <h2 id="sent-documents-title"><T>{"Жөнөтүлгөн документтер"}</T></h2>
              </div>
              <button aria-label="Жабуу" onClick={() => setIsDocumentsOpen(false)} type="button">×</button>
            </header>

            {isDocumentsLoading ? <p className="dashboard-home-documents__state"><T>{"Жүктөлүүдө..."}</T></p> : null}
            {documentsError ? <p className="dashboard-error">{documentsError}</p> : null}
            {!isDocumentsLoading && !documentsError && sentDocuments.length === 0 ? (
              <p className="dashboard-home-documents__state"><T>{"Азырынча жөнөтүлгөн документтер жок."}</T></p>
            ) : null}
            {!isDocumentsLoading && sentDocuments.length ? (
              <div className="dashboard-home-documents__list">
                {sentDocuments.map((document) => (
                  <article key={document.id}>
                    <div className="dashboard-home-documents__document-icon">▧</div>
                    <div>
                      <h3>{document.documentTitle || "Аталышы жок документ"}</h3>
                      <p>{sectionLabels[document.sectionId] || document.sectionId || "Документ"}</p>
                      <small>
                        {document.registrationCode ? `№ ${document.registrationCode} · ` : ""}
                        {document.createdAt ? new Date(document.createdAt).toLocaleString("ky-KG") : ""}
                      </small>
                    </div>
                    <button
                      className="dashboard-home-documents__delete"
                      disabled={deletingDocumentId === document.id}
                      onClick={() => removeSentDocument(document)}
                      type="button"
                    >
                      <T>{deletingDocumentId === document.id ? "Өчүрүлүүдө..." : "Өчүрүү"}</T>
                    </button>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
