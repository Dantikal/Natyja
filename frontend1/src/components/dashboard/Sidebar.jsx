import "./SidebarDesign.css";
import {useLanguage as useCopyLanguage} from "../../i18n.jsx";
import {getMemoLetterIndex} from "../../api/dashboard.js";
import RoleFlag from "../RoleFlag.jsx";
import { T } from "../../i18n.jsx";
import { getUserTypeLabel, isTrainingUnit, TRAINING_UNIT_MODULES, trainingContactLabel } from "../../data/unitTypes.js";
import React from "react";
import { canShowModule } from "../../data/unitTypes.js";
import { useEffect, useState } from "react";

import {
  getChatUnreadCount,
  getCombatTrainingNewsUnreadCount,
  getCombatTrainingPlanUnreadCount,
  getThematicAccountSubmissions,
  markAllCombatTrainingPlansRead,
} from "../../api/dashboard.js";
import navigationSoundUrl from "../../assets/pistol-loaded-to-fire.mp3";

import { readPreferences } from "../../preferences.js";

let navigationAudio;

const playNavigationSound = () => {
  if (!readPreferences().sound) return;
  try {
    navigationAudio ||= new Audio(navigationSoundUrl);
    navigationAudio.currentTime = 0;
    navigationAudio.volume = 0.65;
    navigationAudio.play().catch(() => {});
  } catch {
    // Audio is optional; navigation must remain usable if the browser blocks it.
  }
};

window.addEventListener("preferences:changed", () => {
  if (!readPreferences().sound) navigationAudio?.pause();
});

const BellIcon = () => (
  <svg
    aria-hidden="true"
    fill="none"
    height="16"
    viewBox="0 0 24 24"
    width="16"
  >
    <path
      d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

const getInitials = (user) => {
  const source = user?.full_name || user?.email || "Колдонуучу";
  return source
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
};

const navPaths = {
 home: "m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9",
 library: "M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4V4Zm16 0h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-2h3V4Z",
 combatTrainingJournal: "M6 3h12v18H6zM9 7h6M9 11h6M9 15h4M3 7h3M3 12h3M3 17h3",
 combatTrainingResults: "m8 12 3 3 5-6M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z",
 combatTrainingAnalytics: "M4 20h17M7 16V9M12 16V4M17 16v-5",
 shootingStatements: "M21 12a9 9 0 1 1-9-9M12 7a5 5 0 1 0 5 5M12 12l9-9M17 3h4v4",
 meetings: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-4M16 3a4 4 0 0 1 0 8",
 youngSoldierTrainingCourse: "m12 3 10 5-10 5L2 8l10-5ZM6 10v6l6 3 6-3v-6M22 8v8",
 smr: "M4 3h12l4 4v14H4V3Zm12 0v5h4M8 12h8M8 16h6",
 combatTrainingPlan: "M5 5h14v16H5V5ZM8 3v4M16 3v4M5 10h14M9 14h2M14 14h2M9 17h2",
 combatTrainingReport: "M4 4h16v16H4V4ZM8 8h8M8 12h8M8 16h4",
 contactAdmin: "M21 11a9 9 0 0 1-9 9H4l-2 2v-10a9 9 0 1 1 19-1ZM7 10h10M7 14h6",
 memoLetter: "M3 5h18v14H3V5Zm0 1 9 7 9-7",
 users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M16 11h6",
 requests: "M5 3h14v18H5V3ZM9 7h6M9 11h3M9 16l2 2 4-4",
 submissionEditRequests: "M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4ZM12 8v5M12 16h.01",
 documents: "M8 3h9l4 4v13H8V3ZM3 7v14h13M17 3v5h4",
 archive: "M3 3h18v5H3V3ZM5 8v13h14V8M10 12h4",
 regionalUnitRating: "M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v3a4 4 0 0 0 4 4M16 5h4v3a4 4 0 0 1-4 4M12 13v5M8 21h8M9 18h6",
 aboutPlatform: "M12 8h.01M12 11v6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
 games: "M7 7h10a4 4 0 0 1 4 4l1 6a2 2 0 0 1-3 2l-4-3H9l-4 3a2 2 0 0 1-3-2l1-6a4 4 0 0 1 4-4ZM6 10v5M3.5 12.5h5M16 11h.01M19 14h.01",
 profile: "M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M12 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
 logout: "M9 4H4v16h5M10 12h11m-4-4 4 4-4 4",
};
function NavIcon({id}) {
 const segments=(navPaths[id]||navPaths.regionalUnitRating).match(/[Mm][^Mm]*/g)||[];
 return <svg className={`sidebar-glyph sidebar-glyph--${id}`} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
  {id==='youngSoldierTrainingCourse' ? <><path d="m12 3 10 5-10 5L2 8l10-5ZM6 10v5l6 3 6-3v-5M22 8v7"/><g className="course-opening-book"><path d="M12 18c-2-2-5-2-8-1v5c3-1 6-1 8 1m0-5c2-2 5-2 8-1v5c-3-1-6-1-8 1v-5" fill="var(--sn-panel,#102720)"/></g></> : id==='meetings' ? <><g className="meeting-person meeting-person--first"><circle cx="8" cy="7" r="3"/><path d="M2 21v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2"/></g><g className="meeting-person meeting-person--second"><path d="M16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 4 5v2"/></g></> : id==='shootingStatements' ? <><path d="M21 12a9 9 0 1 1-9-9M12 7a5 5 0 1 0 5 5"/><circle className="target-impact-ring" cx="12" cy="12" r="2"/><g className="target-flying-arrow"><path d="M12 12l9-9M17 3h4v4"/></g></> : id==='home' ? <><path d="m3 10 9-7 9 7M5 9v11h5m4 0h5V9"/><path className="home-door-light" d="M10 14h4v6h-4Z" fill="currentColor" stroke="none"/><g className="home-opening-door"><path d="M10 14h4v6h-4Z" fill="var(--sn-panel,#102720)"/><path d="M13 17h.01"/></g></> : id==='library' ? <><path d="M12 5v16M12 5c-2-2-5-2-8-1v15c3-1 6-1 8 2M12 5c2-2 5-2 8-1v15c-3-1-6-1-8 2"/><g className="book-single-leaf"><path d="M12 5c2-2 5-2 8-1v15c-3-1-6-1-8 2Z" fill="var(--sn-panel,#102720)"/><path d="m15 8 3-1m-3 4 3-1"/></g><g className="book-opening-cover"><path d="M12 5c2-2 5-2 8-1v15c-3-1-6-1-8 2Z" fill="var(--sn-panel,#102720)"/></g></> : id==='combatTrainingResults' ? <><path d="M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path className="results-check-mark" d="m8 12 3 3 5-6"/></> : id==='combatTrainingJournal' ? <><path d="M6 3h12v18H6zM3 7h3M3 12h3M3 17h3"/><path d="M9 7h6M9 11h6M9 15h4"/><g className="journal-turning-page"><path d="M8 4h10v16H8Z" fill="var(--sn-panel,#102720)"/><path d="M10 8h5M10 12h5M10 16h3"/></g></> : id==='contactAdmin' ? <><path d="M21 11a9 9 0 0 1-9 9H4l-2 2v-10a9 9 0 1 1 19-1Z"/>{[7,12,17].map((x,i)=><circle key={x} className="sidebar-chat-dot" style={{'--dot-delay':`${i*90}ms`}} cx={x} cy="11" r=".9" fill="currentColor" stroke="none"/>)}</> : segments.map((d,i)=><path key={i} d={d} style={{'--stroke-delay':`${i*35}ms`}}/>) }
 </svg>;
}
const navCaptions={home:['РАБОЧЕЕ ПРОСТРАНСТВО','ИШ МЕЙКИНДИГИ'],library:['БОЕВАЯ ПОДГОТОВКА','КҮЖҮРМӨН ДАЯРДОО'],smr:['МАТЕРИАЛЫ И СВЯЗЬ','МАТЕРИАЛДАР ЖАНА БАЙЛАНЫШ'],aboutPlatform:['ПЛАТФОРМА','ПЛАТФОРМА']};

const adminItems = [
  { id: "home", label: "Башкы экран" },
  { id: "library", label: "Сабактардын тематикасынын эсеби жана жүгүртмөсү" },
  { id: "combatTrainingJournal", label: "Күжүрмөн даярдоону каттоо журналы" },
  { id: "combatTrainingResults", label: "Күжүрмөн даярдоонун жыйынтыктары ( көзөмөл сабактары, көзөмөл текшерүү сабактары)" },
  { id: "combatTrainingAnalytics", label: "Күжүрмөн даярдоонун талдоолору (1 айдын, окуу мезгилинин, окуу жылынын)" },
  { id: "shootingStatements", label: "Ок атуунун ведомосттору" },
  { id: "meetings", label: "Жыйындар" },
  { id: "youngSoldierTrainingCourse", label: "Жаш жоокерлерди даярдоо курсу" },
  { id: "smr", label: "Күжүрмөн даярдоо боюнча усулдук колдонмолор" },
  { id: "combatTrainingPlan", label: "Күжүрмөн даярдоонун пландалган иш-чаралары" },
  { id: "combatTrainingReport", label: "Күжүрмөн даярдоонун маалыматтары" },
  { id: "contactAdmin", label: "Колдонуучулар менен байланыш" },
  { id: "memoLetter", label: "Билдирме кат" },
];

const getAdminSections = (pendingCount) => [
  { id: "work", items: adminItems },
  {
    id: "admin",
    title: "Админ",
    items: [
      { id: "users", label: "Колдонуучулар" },
      { id: "requests", label: `Өтүнмөлөр (${pendingCount})` },
      { id: "submissionEditRequests", label: "Уруксат сурамдары" },
      { id: "documents", label: "Документтер" },
      { id: "archive", label: "Архив" },
      { id: "regionalUnitRating", label: "Рейтинг" },
    ],
  },
  {
    id: "platform",
    items: [{ id: "aboutPlatform", label: "Платформа боюнча" }],
  },
  {
    id: "games",
    items: [{ id: "games", label: "Оюндар" }],
  },
];

const fieldItems = [
  { id: "home", label: "Башкы экран" },
  { id: "library", label: "Сабактардын тематикасынын эсеби жана жүгүртмөсү" },
  { id: "combatTrainingJournal", label: "Күжүрмөн даярдоону каттоо журналы" },
  { id: "combatTrainingResults", label: "Күжүрмөн даярдоонун жыйынтыктары ( көзөмөл сабактары, көзөмөл текшерүү сабактары)" },
  { id: "combatTrainingAnalytics", label: "Күжүрмөн даярдоонун талдоолору (1 айдын, окуу мезгилинин, окуу жылынын)" },
  { id: "shootingStatements", label: "Ок атуунун ведомосттору" },
  { id: "smr", label: "Күжүрмөн даярдоо боюнча усулдук колдонмолор" },
  { id: "combatTrainingPlan", label: "Күжүрмөн даярдоонун пландалган иш-чаралары" },
  { id: "combatTrainingReport", label: "Күжүрмөн даярдоонун маалыматтары" },
  { id: "contactAdmin", label: "Аскер бөлүгү менен байланыш" },
  { id: "memoLetter", label: "Билдирме кат" },
  { id: "outpostRating", label: "Рейтинг" },
  { id: "aboutPlatform", label: "Платформа боюнча" },
  { id: "games", label: "Оюндар" },
];

const regionalItems = [
  ...fieldItems.slice(0, 6),
  { id: "meetings", label: "Жыйындар" },
  { id: "youngSoldierTrainingCourse", label: "Жаш жоокерлерди даярдоо курсу" },
  ...fieldItems.slice(6).filter((item) => !["aboutPlatform", "games"].includes(item.id)),
  { id: "regionalUsers", label: "Колдонуучулар" },
  ...fieldItems.filter((item) => ["aboutPlatform", "games"].includes(item.id)),
].map((item) => (
  item.id === "contactAdmin"
    ? { ...item, label: "Колдонуучулар менен байланыш" }
    : item
));

export default function Sidebar({
  role,
  activeItem,
  modules,
  unitSelector = null,
  pendingCount = 0,
  user,
  onNavigate,
  onOpenRequests,
  onSignOut,
}) {
 const {t:copyT,language}=useCopyLanguage();
 const languageIndex=language==='ru'?0:1;

  useEffect(()=>{
    const open=()=>{if(window.matchMedia('(max-width:980px)').matches)setMobileOpen(true);requestAnimationFrame(()=>document.querySelector('.dashboard-sidebar__nav button')?.focus());};
    window.addEventListener('munara:keyboard-menu',open);return()=>window.removeEventListener('munara:keyboard-menu',open);
  },[]);
  const avatarSrc = user?.photo_face || user?.avatar;
  const [editRequestCount,setEditRequestCount]=useState(0);
  useEffect(()=>{const update=e=>setEditRequestCount(e.detail);window.addEventListener("edit-requests:count",update);return()=>window.removeEventListener("edit-requests:count",update);},[]);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setMobileOpen(false); }, [activeItem]);
  const isAdminChildActive =
    activeItem === "users" ||
    activeItem === "requests" ||
    activeItem === "submissionEditRequests" ||
    activeItem === "documents" ||
    activeItem === "archive" ||
    activeItem === "regionalUnitRating";
  const [adminOpen, setAdminOpen] = useState(isAdminChildActive);
  const [newsUnreadCount, setNewsUnreadCount] = useState(0);
  const [planUnreadCount, setPlanUnreadCount] = useState(0);
  const [chatUnreadCount, setChatUnreadCount] = useState(modules?.chatUnreadCount || 0);
  const [memoLetterUnreadCount, setMemoLetterUnreadCount] = useState(0);
  const sections =
    role === "admin"
      ? getAdminSections(pendingCount)
      : [{ id: "field", items: isTrainingUnit(user?.unit_type)
          ? TRAINING_UNIT_MODULES.map((id) => ({ ...regionalItems.find((item) => item.id === id), ...(id === "home" ? { label: "Башкы бет" } : id === "contactAdmin" ? { label: trainingContactLabel(user) } : {}) }))
          : role === "regional" ? regionalItems : fieldItems }];
  const hiddenItemIds = new Set(
    modules && !modules.combatTrainingJournal ? ["combatTrainingJournal"] : []
  );

  useEffect(() => {
    if (isAdminChildActive) {
      setAdminOpen(true);
    }
  }, [isAdminChildActive]);

  useEffect(() => {
    if (role === "admin") {
      setNewsUnreadCount(0);
      return undefined;
    }

    let isMounted = true;
    const refreshUnreadCount = async () => {
      try {
        const count = await getCombatTrainingNewsUnreadCount();
        if (isMounted) setNewsUnreadCount(count);
      } catch {
        // The sidebar remains usable while the notification service is unavailable.
      }
    };

    refreshUnreadCount();
    const intervalId = window.setInterval(refreshUnreadCount, 60000);
    window.addEventListener("focus", refreshUnreadCount);
    window.addEventListener("combat-training-news-read", refreshUnreadCount);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshUnreadCount);
      window.removeEventListener("combat-training-news-read", refreshUnreadCount);
    };
  }, [role]);

  useEffect(() => {
    if (role === "admin") {
      setPlanUnreadCount(0);
      return undefined;
    }

    let isMounted = true;
    const refreshPlanUnreadCount = async () => {
      try {
        const count = await getCombatTrainingPlanUnreadCount();
        if (isMounted) setPlanUnreadCount(count);
      } catch {
        // Navigation remains available if notification loading fails.
      }
    };

    refreshPlanUnreadCount();
    const intervalId = window.setInterval(refreshPlanUnreadCount, 60000);
    window.addEventListener("focus", refreshPlanUnreadCount);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshPlanUnreadCount);
    };
  }, [role]);

  useEffect(() => {
    let isMounted = true;
    const refreshChatUnreadCount = async () => {
      try {
        const count = await getChatUnreadCount();
        if (isMounted) setChatUnreadCount(count);
      } catch {
        // The sidebar remains usable while chat notifications are unavailable.
      }
    };

    refreshChatUnreadCount();
    const intervalId = window.setInterval(refreshChatUnreadCount, 15000);
    window.addEventListener("focus", refreshChatUnreadCount);
    window.addEventListener("chat-messages-read", refreshChatUnreadCount);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshChatUnreadCount);
      window.removeEventListener("chat-messages-read", refreshChatUnreadCount);
    };
  }, [role]);

  useEffect(() => {
    if (!["regional", "admin"].includes(role)) {
      setMemoLetterUnreadCount(0);
      return undefined;
    }

    let isMounted = true;
    const refreshMemoLetterUnreadCount = async () => {
      try {
        const submissions = await getMemoLetterIndex();
        const count = (Array.isArray(submissions) ? submissions : []).filter(
          (submission) =>
            submission.sectionId === "memo-letter" &&
            (role === "regional"
              ? submission.senderRole === "outpost"
              : ["outpost", "regional"].includes(submission.senderRole)) &&
            !submission.isRead
        ).length;
        if (isMounted) setMemoLetterUnreadCount(count);
      } catch {
        // The menu remains available if notification loading fails.
      }
    };

    refreshMemoLetterUnreadCount();
    const intervalId = window.setInterval(refreshMemoLetterUnreadCount, 15000);
    window.addEventListener("focus", refreshMemoLetterUnreadCount);
    window.addEventListener("memo-letter-read", refreshMemoLetterUnreadCount);
    window.addEventListener("memo-letter-arrived", refreshMemoLetterUnreadCount);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshMemoLetterUnreadCount);
      window.removeEventListener("memo-letter-read", refreshMemoLetterUnreadCount);
      window.removeEventListener("memo-letter-arrived", refreshMemoLetterUnreadCount);
    };
  }, [role]);

  const handleClick = (itemId) => {
    setMobileOpen(false);
    playNavigationSound();
    if (itemId === "requests") {
      onOpenRequests?.();
      return;
    }

    if (itemId === "combatTrainingPlan" && planUnreadCount > 0) {
      setPlanUnreadCount(0);
      markAllCombatTrainingPlansRead().catch(() => {
        getCombatTrainingPlanUnreadCount()
          .then(setPlanUnreadCount)
          .catch(() => {});
      });
    }

    onNavigate(itemId);
  };

  useEffect(() => {
    if (!mobileOpen) return;
    document.querySelector('.dashboard-sidebar__nav button')?.focus();
    const close = event => { if (event.key === 'Escape') { setMobileOpen(false); requestAnimationFrame(()=>document.querySelector('.mobile-menu-toggle')?.focus()); } };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [mobileOpen]);

  return (<>
    {mobileOpen && <button className="mobile-menu-backdrop" aria-label="Закрыть меню / Менюну жабуу" onClick={() => setMobileOpen(false)} />}
    <aside className={`dashboard-sidebar sidebar-refined${mobileOpen ? " is-menu-open" : ""}`}>
      <button className="mobile-menu-toggle" type="button" aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)}>
        {mobileOpen ? "✕ " : "☰ "}<T>{mobileOpen ? "Менюну жабуу" : "Меню"}</T>
      </button>
      <div className="sidebar-eyebrow"><span className="sidebar-eyebrow__mark">КA</span><span>КҮЖҮРМӨН АСКЕР<small>{language==='ru'?'Центр управления':'Башкаруу борбору'}</small></span><span className="sidebar-live-dot" aria-hidden="true"/></div>
      <div className="dashboard-user-card">
        <div className="profile-avatar">
          {avatarSrc ? (
            <img alt={user.full_name || user.email} src={avatarSrc} />
          ) : (
            <span>{getInitials(user)}</span>
          )}
        </div>
        <div>
          <strong><T>{user?.full_name || user?.email || "Колдонуучу"}</T></strong>
          <span>
            <T>{getUserTypeLabel(user, role)}</T>
            <RoleFlag role={user?.role || role} />
          </span>
        </div>
        <button
          className={activeItem === "profile" ? "is-active profile-open-button" : "profile-open-button"}
          onClick={() => {
            playNavigationSound();
            onNavigate("profile");
            setMobileOpen(false);
          }}
          type="button"
        ><NavIcon id="profile"/><T>{"Жеке кабинетим"}</T><span aria-hidden="true" className="sidebar-profile-arrow">↗</span></button>
      </div>
      {unitSelector}

      <nav className="dashboard-sidebar__nav" aria-label="Меню" onKeyDown={event=>{
        if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
        const buttons=[...event.currentTarget.querySelectorAll('button:not(:disabled)')].filter(button=>button.getClientRects().length);
        const index=buttons.indexOf(document.activeElement);if(index<0)return;
        event.preventDefault();
        const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
        buttons[next]?.focus();
      }}>
        {sections.map((section, sectionIndex) => (
          <div className="dashboard-sidebar__group" key={section.id}>
            {section.title && (
              <button
                className={adminOpen ? "dashboard-sidebar__group-toggle is-open" : "dashboard-sidebar__group-toggle"}
                onClick={() => {
                  playNavigationSound();
                  setAdminOpen((current) => !current);
                }}
                type="button"
                aria-expanded={adminOpen}
              >
                <span className="sidebar-section-rule"/><T>{section.title}</T>
              </button>
            )}
            {(!section.title || adminOpen) &&
              section.items.filter((item) => !hiddenItemIds.has(item.id) && canShowModule(user, item.id)).map((item, itemIndex) => (
                <React.Fragment key={item.id}>
                {navCaptions[item.id] && <div className="sidebar-section-caption"><span>{navCaptions[item.id][languageIndex]}</span><i/></div>}
                <button
                  type="button"
                  aria-current={activeItem===item.id?"page":undefined}
                  title={copyT(item.label)}
                  className={[
                    activeItem === item.id ? "is-active" : "",
                    section.title ? "dashboard-sidebar__subitem" : "",
                    `dashboard-sidebar__hover--${(sectionIndex + itemIndex) % 6 + 1}`,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={item.id}
                  onClick={() => handleClick(item.id)}
                >
                  <span className="sidebar-item-icon"><NavIcon id={item.id}/></span>
                  <span className="dashboard-sidebar__item-label">{copyT(item.label)}</span>
                  {activeItem===item.id&&<span className="sidebar-active-dot" aria-hidden="true"/>}
                  {item.id === "contactAdmin" && chatUnreadCount > 0 ? (
                    <span className="dashboard-sidebar__item-badge">{chatUnreadCount}</span>
                  ) : null}
                  {item.id === "submissionEditRequests" && editRequestCount > 0 && <span className="dashboard-sidebar__item-badge">{editRequestCount}</span>}
                  {item.id === "memoLetter" && memoLetterUnreadCount > 0 ? (
                    <span
                      aria-label={`Жаңы билдирме каттар: ${memoLetterUnreadCount}`}
                      className="dashboard-sidebar__item-badge"
                    >
                      {memoLetterUnreadCount}
                    </span>
                  ) : null}
                  {item.id === "combatTrainingReport" && newsUnreadCount > 0 ? (
                    <span
                      aria-label={`Жаңы маалыматтар: ${newsUnreadCount}`}
                      className="dashboard-sidebar__item-badge dashboard-sidebar__item-badge--bell"
                      title={copyT("Жаңы маалымат")}
                    >
                      <BellIcon />
                    </span>
                  ) : null}
                  {item.id === "combatTrainingPlan" && planUnreadCount > 0 ? (
                    <span
                      aria-label={copyT("Пландалган иш-чаралар жаңыртылды")}
                      className="dashboard-sidebar__item-badge dashboard-sidebar__item-badge--bell"
                      title={copyT("Жаңы жаңыртуу")}
                    >
                      <BellIcon />
                    </span>
                  ) : null}
                </button>
                </React.Fragment>
              ))}
          </div>
        ))}
      </nav>
      <button type="button" className="sidebar-sign-out" onClick={()=>{setMobileOpen(false);onSignOut?.();}}><NavIcon id="logout"/> <T>{"Чыгуу"}</T></button>
    </aside></>
  );
}
