import {useSectionEntrance} from "../hooks/useSectionEntrance.js";
import PageHelp from "../components/PageHelp.jsx";
import { T } from "../i18n.jsx";
import { useHistoryState } from "../hooks/useHistoryState.js";
import { isTrainingUnit, TRAINING_UNIT_MODULES } from "../data/unitTypes.js";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import Sidebar from "../components/dashboard/Sidebar.jsx";
import DashboardPrintButton from "../components/dashboard/DashboardPrintButton.jsx";
import DashboardModuleView from "../components/dashboard/modules/DashboardModuleView.jsx";
import { fetchDashboard } from "../features/dashboard/dashboardSlice.js";
import OutpostRatingPage from "../features/regional/OutpostRatingPage.jsx";

export default function OutpostDashboard({ onSignOut }) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { data, loading, error, role } = useSelector((state) => state.dashboard);
  const [activeView, setActiveView] = useHistoryState(`dashboard:${user?.id}:${user?.role}`, "home");
  useSectionEntrance(activeView);
  useEffect(()=>{const home=()=>setActiveView('home');window.addEventListener('munara:navigate-home',home);return()=>window.removeEventListener('munara:navigate-home',home);},[setActiveView]);

  useEffect(()=>{const open=()=>setActiveView("memoLetter");window.addEventListener("munara:open-memo",open);return()=>window.removeEventListener("munara:open-memo",open);},[setActiveView]);
  useEffect(() => { const open = () => setActiveView("contactAdmin"); window.addEventListener("munara:open-chat", open); return () => window.removeEventListener("munara:open-chat", open); }, [setActiveView]);

  useEffect(() => {
    if (user?.role === "outpost" && role !== "outpost") {
      dispatch(fetchDashboard("outpost"));
    }
  }, [dispatch, role, user?.role]);

  if (user?.role !== "outpost") {
    return <section className="dashboard-state error"><T>{"Заставанын жеке кабинетине кирүүгө уруксат жок."}</T></section>;
  }

  if (loading && !data) {
    return <section className="dashboard-state"><T>{"Жүктөлүүдө..."}</T></section>;
  }

  if (error && !data) {
    return <section className="dashboard-state error"><T>{error}</T></section>;
  }

  if (!data) {
    return null;
  }

  const visibleView = isTrainingUnit(user?.unit_type) &&
    ![...TRAINING_UNIT_MODULES, "profile"].includes(activeView) ? "home" : activeView;

  const refreshDashboard = () => dispatch(fetchDashboard("outpost"));

  return (
    <div className="dashboard-layout">
      <Sidebar
        onSignOut={onSignOut}
        activeItem={visibleView}
        modules={data.modules}
        onNavigate={setActiveView}
        role="outpost"
        user={user}
      />

      <section className="dashboard-content" id="dashboard-main" tabIndex={-1}>
        <PageHelp page={visibleView} />
        <DashboardPrintButton />
        {visibleView === "outpostRating" ? (
          <OutpostRatingPage user={user} />
        ) : (
          <DashboardModuleView
            activeModule={visibleView}
            dashboardData={data}
            modules={data.modules}
            onNavigate={setActiveView}
            onRefresh={refreshDashboard}
            user={user}
          />
        )}
      </section>
    </div>
  );
}
