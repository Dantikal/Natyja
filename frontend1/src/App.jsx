import ManagementDashboard from "./pages/ManagementDashboard.jsx";
import { T } from "./i18n.jsx";
import React from "react";
import PageHelp from "./components/PageHelp.jsx";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import CombatPlatformLogo from "./assets/combat-platform-logo.png";
import BorderServiceLogo from "./components/BorderServiceLogo.jsx";
import LoginPage from "./features/auth/LoginPage.jsx";
import RegistrationForm from "./components/RegistrationForm.jsx";
import ProfileEditForm from "./components/dashboard/modules/ProfileEditForm.jsx";
import { logout } from "./features/auth/authSlice.js";
import { resetDashboard } from "./features/dashboard/dashboardSlice.js";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import OutpostDashboard from "./pages/OutpostDashboard.jsx";
import RegionalDashboard from "./pages/RegionalDashboard.jsx";

const AUTH_NETWORK_POINTS = [
  [3, 72], [9, 57], [15, 76], [21, 48], [28, 66], [34, 38], [41, 59],
  [48, 31], [54, 53], [61, 24], [67, 47], [73, 18], [78, 41], [84, 29],
  [89, 56], [95, 37], [24, 88], [39, 82], [55, 76], [70, 86], [85, 77], [97, 82],
];

const AUTH_NETWORK_LINKS = [
  [0, 1], [0, 2], [1, 2], [1, 3], [2, 3], [2, 4], [3, 4], [3, 5],
  [4, 5], [4, 6], [4, 16], [5, 6], [5, 7], [6, 7], [6, 8], [6, 17],
  [7, 8], [7, 9], [8, 9], [8, 10], [8, 18], [9, 10], [9, 11], [10, 11],
  [10, 12], [10, 18], [11, 12], [11, 13], [12, 13], [12, 14], [13, 14],
  [13, 15], [14, 15], [14, 20], [15, 21], [16, 17], [17, 18], [18, 19],
  [19, 20], [20, 21], [14, 19], [18, 20],
];

function AuthNetwork({ className = "auth-network" }) {
  return (
    <svg aria-hidden="true" className={className} preserveAspectRatio="none" viewBox="0 0 100 100">
      <g className="auth-network__links">
        {AUTH_NETWORK_LINKS.map(([from, to], index) => (
          <line
            key={`${from}-${to}`}
            style={{ "--link-delay": `${-(index % 12) * 0.42}s` }}
            x1={AUTH_NETWORK_POINTS[from][0]}
            x2={AUTH_NETWORK_POINTS[to][0]}
            y1={AUTH_NETWORK_POINTS[from][1]}
            y2={AUTH_NETWORK_POINTS[to][1]}
          />
        ))}
      </g>
    </svg>
  );
}

export default function App() {
  const { user } = useSelector((state) => state.auth);
  const [page, setPage] = useState(user ? "dashboard" : "register");
  const [introIsVisible, setIntroIsVisible] = useState(true);
  const [introIsLeaving, setIntroIsLeaving] = useState(false);
  const dispatch = useDispatch();

  useEffect(() => {
    const expireSession = () => {
      dispatch(logout());
      dispatch(resetDashboard());
      setPage("login");
    };
    window.addEventListener("auth:expired", expireSession);
    return () => window.removeEventListener("auth:expired", expireSession);
  }, [dispatch]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const leaveTimer = window.setTimeout(() => setIntroIsLeaving(true), reducedMotion ? 80 : 1550);
    const closeTimer = window.setTimeout(() => setIntroIsVisible(false), reducedMotion ? 180 : 2000);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(closeTimer);
    };
  }, []);

  useEffect(() => {
    if (user && (page === "login" || page === "register")) {
      setPage("dashboard");
    }

    if (!user && page === "dashboard") {
      setPage("login");
    }
  }, [page, user]);

  const signOut = () => {
    dispatch(logout());
    dispatch(resetDashboard());
    setPage("login");
  };

  const renderDashboard = () => {
    if (!user) {
      return <LoginPage onLoggedIn={() => setPage("dashboard")} />;
    }

    if (user.role === "management") return <RegionalDashboard onSignOut={signOut}/>;
    if (user.role === "admin") {
      return <AdminDashboard onSignOut={signOut} />;
    }

    if (user.role === "regional") {
      return <RegionalDashboard onSignOut={signOut} />;
    }

    if (user.role === "outpost") {
      return <OutpostDashboard onSignOut={signOut} />;
    }

    return <section className="panel"><T>{"Сиздин ролуңуз үчүн башкаруу панели жөндөлгөн эмес."}</T></section>;
  };

  const renderAuthPage = () => (
    <section className="auth-screen">
      <div aria-hidden="true" className="auth-hud auth-hud--top" />
      <div aria-hidden="true" className="auth-hud auth-hud--bottom" />
      <AuthNetwork />
      <div aria-hidden="true" className="auth-green-particles">
        {Array.from({ length: 72 }, (_, index) => (
          <span
            key={index}
            style={{
              "--particle-delay": `${-((index * 1.21) % 12)}s`,
              "--particle-duration": `${7 + (index % 6) * 0.85}s`,
              "--particle-left": `${2 + ((index * 29) % 96)}%`,
              "--particle-size": `${3 + (index % 4)}px`,
              "--particle-drift": `${-35 + ((index * 17) % 70)}px`,
            }}
          />
        ))}
      </div>
      <div className="auth-corner-brand">
        <BorderServiceLogo large />
      </div>
      <div className="auth-corner-platform-logo">
        <img alt="Күжүрмөн Аскер 1.0" src={CombatPlatformLogo} />
      </div>
      <div className={`auth-card auth-card--${page}`} key={page}>
        <header className="auth-brand">
          <div className="auth-brand-emblems"><BorderServiceLogo large /><img className="auth-brand-platform-emblem" alt="КҮЖҮРМӨН АСКЕР 1.0" src={CombatPlatformLogo}/></div>
          <h1><T>{"КҮЖҮРМӨН АСКЕР 1.0"}</T></h1>
          <p><T>{"Күжүрмөн даярдоо санарип платформасы"}</T></p>
        </header>
        <nav className="auth-tabs">
          <button
            className={page === "login" ? "is-active" : ""}
            onClick={() => setPage("login")}
          ><T>{"Кирүү"}</T></button>
          <button
            className={page === "register" ? "is-active" : ""}
            onClick={() => setPage("register")}
          ><T>{"Каттоо"}</T></button>
        </nav>
        {page === "login" && <LoginPage onLoggedIn={() => setPage("dashboard")} />}
        {page === "register" && <RegistrationForm />}
      </div>
    </section>
  );

  const renderIntro = () => (
    <div
      aria-label="Загрузка платформы"
      aria-live="polite"
      className={`site-intro${introIsLeaving ? " site-intro--leaving" : ""}`}
      role="status"
    >
      <div aria-hidden="true" className="site-intro__grid" />
      <div aria-hidden="true" className="site-intro__glow site-intro__glow--one" />
      <div aria-hidden="true" className="site-intro__glow site-intro__glow--two" />
      <div className="site-intro__content">
        <BorderServiceLogo large />
        <div className="site-intro__title">
          <strong><T>{"КҮЖҮРМӨН АСКЕР"}</T></strong>
          <span>1.0</span>
        </div>
        <p><T>{"Күжүрмөн даярдоо санарип платформасы"}</T></p>
        <div className="site-intro__loader" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );

  if (!user && (page === "register" || page === "login")) {
    return (
      <>
        <main className="app-shell auth-shell"><PageHelp page={page} />{renderAuthPage()}</main>
        {introIsVisible && renderIntro()}
      </>
    );
  }

  return (
    <>
      <main className="app-shell">
      <header className="topbar">
        <div aria-hidden="true" className="topbar-particles">
          {Array.from({ length: 64 }, (_, index) => (
            <span
              key={index}
              style={{
                "--topbar-particle-delay": `${-((index * 0.73) % 9)}s`,
                "--topbar-particle-duration": `${5.5 + (index % 5) * 0.8}s`,
                "--topbar-particle-size": `${2 + (index % 4)}px`,
                "--topbar-particle-top": `${12 + ((index * 31) % 76)}%`,
              }}
            />
          ))}
        </div>
        <div className="brand-lockup">
          <div>
            <strong><T>{"КҮЖҮРМӨН АСКЕР 1.0"}</T></strong>
            <span><T>{"Күжүрмөн даярдоо санарип платформасы"}</T></span>
          </div>
        </div>
        <div className="topbar-seal">
          <BorderServiceLogo large />
        </div>
        <nav>
          {!user && <button onClick={() => setPage("register")}><T>{"Каттоо"}</T></button>}
          {!user && <button onClick={() => setPage("login")}><T>{"Кирүү"}</T></button>}

        </nav>
      </header>

      {user && user.profile_completed === false ? (
        <div className="profile-completion-modal" role="dialog" aria-modal="true" aria-labelledby="profile-completion-title">
          <section className="profile-completion-modal__panel">
            <header>
              <h1 id="profile-completion-title"><T>{"Каттоо маалыматын толтуруңуз"}</T></h1>
              <p><T>{"Системада иштөөнү улантуу үчүн калган талааларды толтуруп, сактаңыз."}</T></p>
            </header>
            <ProfileEditForm requiredCompletion user={user} />
          </section>
        </div>
      ) : null}

      {page === "register" && <RegistrationForm />}
      {page === "login" && <LoginPage onLoggedIn={() => setPage("dashboard")} />}
      {page === "dashboard" && renderDashboard()}
      </main>
      {introIsVisible && renderIntro()}
    </>
  );
}
