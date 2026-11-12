import {useLanguage as useCopyLanguage} from "../../i18n.jsx";
import { T } from "../../i18n.jsx";
import { getUserTypeLabel } from "../../data/unitTypes.js";
import React, { useEffect, useMemo, useState } from "react";

import { getScopedUsers } from "../../api/dashboard.js";
import { getApiErrorMessage } from "../../api/errors.js";

const formatPresence = (user) => {
  if (user?.isOnline) return "Онлайн";
  if (!user?.lastSeen) return "Азырынча кире элек";
  const date = new Date(user.lastSeen);
  if (Number.isNaN(date.getTime())) return "Оффлайн";
  return `Был(а) в ${date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const getInitials = (user) =>
  String(user?.full_name || user?.email || "К")
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

export default function RegionalUsersPage({ user: currentUser }) {
 const {t:copyT}=useCopyLanguage();

  const [selectedUser,setSelectedUser]=useState(null);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadUsers = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const items = await getScopedUsers();
      setUsers((Array.isArray(items) ? items : []).filter(
        (item) =>
          String(item.id) !== String(currentUser?.id) &&
          String(item.region || "") === String(currentUser?.region || "")
      ));
      setError("");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Колдонуучуларды жүктөө мүмкүн болгон жок."));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    const intervalId = window.setInterval(() => loadUsers(true), 30000);
    const refreshOnFocus = () => loadUsers(true);
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [currentUser?.id, currentUser?.region]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ru");
    if (!normalizedQuery) return users;
    return users.filter((item) => [
      item.full_name,
      item.email,
      item.phone,
      item.outpost_name,
      item.military_rank,
      item.position,
    ].some((value) => String(value || "").toLocaleLowerCase("ru").includes(normalizedQuery)));
  }, [query, users]);

  if(selectedUser)return <section className="module-panel admin-users-page">
    <button type="button" className="module-back-button" onClick={()=>setSelectedUser(null)}><T>Артка</T></button>
    <header className="admin-user-detail__header"><span className="admin-user-avatar">{selectedUser.photo_face||selectedUser.avatar?<img alt="" src={selectedUser.photo_face||selectedUser.avatar}/>:getInitials(selectedUser)}</span><div><h1>{selectedUser.full_name||selectedUser.email}</h1><p><T>{getUserTypeLabel(selectedUser)}</T> · {selectedUser.outpost_name||selectedUser.region}</p></div></header>
    <dl className="profile-details">{[['Электрондук почта',selectedUser.email],['Аскер бөлүгүнүн номери',selectedUser.region],['Заставанын аталышы',selectedUser.outpost_name],['Телефон',selectedUser.phone],['Аскердик наамы',selectedUser.military_rank],['Кызматы',selectedUser.position]].map(([label,value])=><div key={label}><dt><T>{label}</T></dt><dd>{value||'—'}</dd></div>)}</dl>
    <button type="button" onClick={()=>{sessionStorage.setItem(`munara:open-chat:${currentUser.id}`,String(selectedUser.id));window.dispatchEvent(new Event('munara:open-chat'));}}><T>Написать</T></button>
  </section>;
  return (
    <section className="module-panel admin-users-page">
      <header className="admin-users-page__header">
        <div>
          <h1><T>{"Колдонуучулар"}</T></h1>
          <p><T>{"Аскер бөлүгү "}</T>{currentUser?.region || "—"}<T>{" · Колдонуучулар: "}</T>{users.length}</p>
        </div>
      </header>

      <div className="admin-user-search-filters regional-users-page__search">
        <label className="admin-user-search-filters__search">
          <span><T>{"Издөө"}</T></span>
          <input
            aria-label={copyT("Колдонуучуларды издөө")}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copyT("Аты-жөнү, застава, email...")}
            type="search"
            value={query}
          />
        </label>
      </div>

      {error ? <p className="dashboard-error"><T>{error}</T></p> : null}
      {loading ? <p className="dashboard-state"><T>{"Колдонуучулар жүктөлүүдө..."}</T></p> : null}
      {!loading && !error && filteredUsers.length === 0 ? (
        <p className="dashboard-state"><T>{"Колдонуучулар табылган жок."}</T></p>
      ) : null}
      {!loading && filteredUsers.length > 0 ? (
        <div className="admin-user-card-list">
          {filteredUsers.map((item) => {
            const avatar = item.photo_face || item.avatar;
            return (
              <button type="button" className="admin-user-list-card" key={item.id} onClick={()=>setSelectedUser(item)}>
                <span className="admin-user-avatar">
                  {avatar ? <img alt="" src={avatar} /> : <span>{getInitials(item)}</span>}
                </span>
                <span className="admin-user-list-card__text">
                  <strong>{item.full_name || item.email}</strong>
                  <small><T>{getUserTypeLabel(item)}</T> · {item.outpost_name || item.region}</small>
                  <small>{item.email}</small>
                  <small className={item.isOnline ? "user-presence is-online" : "user-presence"}>
                    {formatPresence(item)}
                  </small>
                </span>
                <span aria-hidden="true" className="admin-user-list-card__arrow">›</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
