import ReadOnlyCabinet from "../components/ReadOnlyCabinet.jsx";
import {api,setObservedUnit} from "../api/client.js";
import {useSectionEntrance} from "../hooks/useSectionEntrance.js";
import PageHelp from "../components/PageHelp.jsx";
import { canShowModule } from "../data/unitTypes.js";
import { T, useLanguage } from "../i18n.jsx";
import { useHistoryState } from "../hooks/useHistoryState.js";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import Sidebar from "../components/dashboard/Sidebar.jsx";
import DashboardPrintButton from "../components/dashboard/DashboardPrintButton.jsx";
import DashboardModuleView from "../components/dashboard/modules/DashboardModuleView.jsx";
import { fetchDashboard } from "../features/dashboard/dashboardSlice.js";
import RegionalUsersPage from "../features/regional/RegionalUsersPage.jsx";
import OutpostRatingPage from "../features/regional/OutpostRatingPage.jsx";

export default function RegionalDashboard({ onSignOut }) {
  const dispatch = useDispatch();
  const {language}=useLanguage();
  const [selectedUnit,setSelectedUnit]=useState('');
  const { user } = useSelector((state) => state.auth);
  const { data, loading, error, role } = useSelector((state) => state.dashboard);
  const observing=!!selectedUnit && selectedUnit!==String(user?.region);
  const [observedData,setObservedData]=useState(null),[observeError,setObserveError]=useState('');
  useEffect(()=>{
    let active=true;
    setObservedData(null);setObserveError('');
    if(observing) api.get('/dashboard/regional/').then(r=>{if(active)setObservedData(r.data);}).catch(e=>{if(active)setObserveError(e.response?.data?.detail||'Не удалось открыть кабинет части.');});
    return()=>{active=false;};
  },[selectedUnit,observing]);
  useEffect(()=>()=>setObservedUnit(''),[]);
  const cabinetData=observing?observedData:data;
  const cabinetUser=observing?observedData?.observedUser:user;
  const chooseUnit=value=>{setObservedUnit(value===String(user.region)?'':value);setObservedData(null);setSelectedUnit(value);setActiveView('home');};
  const [storedView, setActiveView] = useHistoryState(`dashboard:${user?.id}:${user?.role}`, "home");
  useEffect(()=>{const home=()=>setActiveView('home');window.addEventListener('munara:navigate-home',home);return()=>window.removeEventListener('munara:navigate-home',home);},[setActiveView]);
  const activeView = canShowModule(user, storedView) ? storedView : "home";
  useSectionEntrance(activeView);

  useEffect(()=>{const open=()=>setActiveView("memoLetter");window.addEventListener("munara:open-memo",open);return()=>window.removeEventListener("munara:open-memo",open);},[setActiveView]);
  useEffect(() => { const open = () => setActiveView("contactAdmin"); window.addEventListener("munara:open-chat", open); return () => window.removeEventListener("munara:open-chat", open); }, [setActiveView]);

  useEffect(() => {
    if (["regional","management"].includes(user?.role) && (!data || role !== "regional")) {
      dispatch(fetchDashboard("regional"));
    }
  }, [data, dispatch, role, user?.role]);

  if (!["regional","management"].includes(user?.role)) {
    return <section className="dashboard-state error"><T>{"Облустук башкаруу панелине кирүүгө уруксат жок."}</T></section>;
  }

  if (loading && !data) {
    return <section className="dashboard-state"><T>{"Маалымат жүктөлүүдө..."}</T></section>;
  }

  if (error && !data) {
    return <section className="dashboard-state error"><T>{error}</T></section>;
  }

  if (!data) {
    return null;
  }

  const refreshDashboard = () => dispatch(fetchDashboard("regional"));
  const navigateTo = moduleId => {
    setActiveView(moduleId);
    requestAnimationFrame(()=>document.getElementById('dashboard-main')?.scrollTo({top:0,behavior:'instant'}));
  };

  return (
    <div className="dashboard-layout">
      <Sidebar
        unitSelector={(['2022','2027'].includes(String(user.region)))&&<label className="management-sidebar-selector"><T>Выбрать подразделение</T><select value={selectedUnit||String(user.region)} onChange={e=>chooseUnit(e.target.value)}>{[String(user.region),...(String(user.region)==='2022'?['2021','2023']:['2030'])].map(number=><option value={number} key={number}><T>Воинская часть</T> {number}</option>)}</select></label>}
        onSignOut={onSignOut}
        activeItem={activeView}
        modules={cabinetData?.modules||data.modules}
        role="regional"
        user={cabinetUser||user}
        onNavigate={navigateTo}
      />

      <section className="dashboard-content" id="dashboard-main" data-active-module={activeView} tabIndex={-1}>
        <PageHelp page={activeView} />
        <DashboardPrintButton />
        {error && <p className="dashboard-error"><T>{error}</T></p>}
        {observing&&<p role="status" className="management-selected-unit">{language==='ru'?'Воинская часть':'Аскер бөлүгү'} {selectedUnit} · {language==='ru'?'Только просмотр':'Көрүү гана'}</p>}
        {observing&&!observedData ? <p role={observeError?'alert':'status'}>{observeError||'Загрузка…'}</p> : <ReadOnlyWrapper enabled={observing} key={`${selectedUnit}:${activeView}`}>
        {activeView === "regionalUsers" ? (
          <RegionalUsersPage user={cabinetUser} />
        ) : activeView === "outpostRating" ? (
          <OutpostRatingPage user={cabinetUser} />
        ) : (
          <DashboardModuleView
            key={`${cabinetUser?.id}:${activeView}`}
            activeModule={activeView}
            dashboardData={cabinetData}
            modules={cabinetData?.modules}
            onNavigate={navigateTo}
            user={cabinetUser}
            onRefresh={refreshDashboard}
          />
        )}</ReadOnlyWrapper>}
      </section>
    </div>
  );
}

function ReadOnlyWrapper({enabled,children}){return enabled?<ReadOnlyCabinet>{children}</ReadOnlyCabinet>:children;}
