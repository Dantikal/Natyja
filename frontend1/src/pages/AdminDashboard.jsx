import {useSectionEntrance} from "../hooks/useSectionEntrance.js";
import PendingEditRequestsBanner from "../components/PendingEditRequestsBanner.jsx";
import PageHelp from "../components/PageHelp.jsx";
import { T } from "../i18n.jsx";
import { useHistoryState } from "../hooks/useHistoryState.js";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import Sidebar from "../components/dashboard/Sidebar.jsx";
import DashboardPrintButton from "../components/dashboard/DashboardPrintButton.jsx";
import DashboardModuleView from "../components/dashboard/modules/DashboardModuleView.jsx";
import AdminRequestsPage from "../features/admin/AdminRequestsPage.jsx";
import AdminUsersPage from "../features/admin/AdminUsersPage.jsx";
import AdminArchivePage from "../features/admin/AdminArchivePage.jsx";
import RegionalUnitRatingPage from "../features/admin/RegionalUnitRatingPage.jsx";
import SubmissionEditRequestsPage from "../features/admin/SubmissionEditRequestsPage.jsx";
import { fetchDashboard } from "../features/dashboard/dashboardSlice.js";

export default function AdminDashboard({ onSignOut }) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { data, loading, error, role } = useSelector((state) => state.dashboard);
  const [activeView, setActiveView] = useHistoryState(`dashboard:${user?.id}:${user?.role}`, "home");
  useSectionEntrance(activeView);
  useEffect(()=>{const home=()=>setActiveView('home');window.addEventListener('munara:navigate-home',home);return()=>window.removeEventListener('munara:navigate-home',home);},[setActiveView]);
  const [chatPartnerId, setChatPartnerId] = useState(null);
  useEffect(()=>{const open=()=>setActiveView("submissionEditRequests");window.addEventListener("munara:open-edit-requests",open);return()=>window.removeEventListener("munara:open-edit-requests",open);},[setActiveView]);

  useEffect(()=>{const open=()=>setActiveView("memoLetter");window.addEventListener("munara:open-memo",open);return()=>window.removeEventListener("munara:open-memo",open);},[setActiveView]);
  useEffect(() => { const open = () => setActiveView("contactAdmin"); window.addEventListener("munara:open-chat", open); return () => window.removeEventListener("munara:open-chat", open); }, [setActiveView]);

  useEffect(() => {
    if (user?.role === "admin" && role !== "admin") {
      dispatch(fetchDashboard("admin"));
    }
  }, [dispatch, role, user?.role]);

  if (user?.role !== "admin") {
    return <section className="dashboard-state error"><T>{"Администратордун башкаруу панелине кирүүгө уруксат жок."}</T></section>;
  }

  if (loading && !data) {
    return <section className="dashboard-state"><T>{"Башкаруу панели жүктөлүүдө..."}</T></section>;
  }

  if (error && !data) {
    return <section className="dashboard-state error"><T>{error}</T></section>;
  }

  if (!data) {
    return null;
  }

  const refreshDashboard = () => dispatch(fetchDashboard("admin"));
  const pendingCount = data.stats.find((item) => item.id === "pending")?.value || 0;
  const navigate = (view) => {
    setChatPartnerId(null);
    setActiveView(view);
  };
  const openUserChat = (selectedUser) => {
    setChatPartnerId(selectedUser.id);
    setActiveView("contactAdmin");
  };

  return (
    <div className="dashboard-layout">
      <Sidebar
        onSignOut={onSignOut}
        activeItem={activeView}
        modules={data.modules}
        pendingCount={pendingCount}
        role="admin"
        user={user}
        onNavigate={navigate}
        onOpenRequests={() => setActiveView("requests")}
      />

      <section className="dashboard-content" id="dashboard-main" tabIndex={-1}>
        <PageHelp page={activeView} />
        <DashboardPrintButton />
        {activeView!=="submissionEditRequests"&&<PendingEditRequestsBanner onOpen={()=>setActiveView("submissionEditRequests")}/> }
        {activeView === "requests" ? (
          <AdminRequestsPage user={user} />
        ) : activeView === "submissionEditRequests" ? (
          <SubmissionEditRequestsPage user={user} />
        ) : activeView === "users" ? (
          <AdminUsersPage onMessageUser={openUserChat} user={user} />
        ) : activeView === "archive" ? (
          <AdminArchivePage user={user} />
        ) : activeView === "regionalUnitRating" ? (
          <RegionalUnitRatingPage />
        ) : (
          <DashboardModuleView
            activeModule={activeView}
            dashboardData={data}
            initialChatPartnerId={chatPartnerId}
            modules={data.modules}
            onNavigate={navigate}
            user={user}
            onRefresh={refreshDashboard}
          />
        )}
      </section>
    </div>
  );
}
