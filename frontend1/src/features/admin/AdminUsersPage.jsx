import { notifySave } from "../../utils/saveFeedback.js";
import { T, useLanguage } from "../../i18n.jsx";
import TrainingUnitFields from "../../components/TrainingUnitFields.jsx";
import { isInstitutionSubunit, isTrainingUnit } from "../../data/unitTypes.js";
import { getUserTypeLabel, unitLabels } from "../../data/unitTypes.js";
import React, { useEffect, useRef, useState } from "react";

import { api } from "../../api/client.js";
import { getApiErrorMessage } from "../../api/errors.js";
import {
  MILITARY_UNIT_OPTIONS,
  OUTPOST_MILITARY_UNIT_OPTIONS,
  OUTPOSTS_BY_MILITARY_UNIT,
  formatOutpostName,
} from "../../data/militaryUnits.js";

const roleLabels = {
  admin: "Администратор",
  regional: "Аскер бөлүгү",
  outpost: "Застава",
};

const namedSubunitLabels = {
  checkpoint: "Көзөмөл өткөрмө пунктунун аталышы",
  detachment: "Отрядтын аталышы",
  group: "Топтун аталышы",
  company: "Ротанын аталышы",
  platoon: "Взводдун аталышы",
  course_head: "Курстун аталышы",
};

const statusLabels = {
  active: "Активдүү",
  pending: "Күтүүдө",
  rejected: "Четке кагылган",
};

const createEmptyForm = (role = "outpost") => ({
  id: null,
  email: "",
  password: "",
  full_name: "",
  military_rank: "",
  position: "",
  unit_type: role === "admin" ? "" : role === "regional" ? "regional_department" : "outpost",
  phone: "",
  region: "",
  outpost_name: "",
  training_center: "",
  platoon_number: "",
  role,
  status: "active",
  photo_face: null,
});

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ky-KG");
};

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
  String(user?.full_name || user?.email || "П")
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

const getUnitName = (user) => {
  if (user?.role === "admin") {
    return user.is_superuser ? "Главный администратор" : "Администратор";
  }
  if (user?.role === "outpost") {
    return user.outpost_name || unitLabels[user.unit_type] || "Застава көрсөтүлгөн эмес";
  }
  if (!user?.region) return "Аскер бөлүгүнүн номери көрсөтүлгөн эмес";
  return /^[0-9]+$/.test(user.region) ? `${user.region} аскер бөлүгү` : user.region;
};

const toForm = (user) => ({
  id: user.id,
  email: user.email || "",
  password: "",
  full_name: user.full_name || "",
  military_rank: user.military_rank || "",
  position: user.position || "",
  unit_type: user.role === "admin"
    ? ""
    : user.unit_type || (user.role === "regional" ? "regional_department" : "outpost"),
  phone: user.phone || "",
  region: user.region || "",
  outpost_name:
    user.unit_type === "outpost"
      ? formatOutpostName(user.outpost_name)
      : user.role === "outpost"
        ? user.outpost_name || ""
        : "",
  training_center: user.training_center || "",
  platoon_number: user.platoon_number || "",
  role: user.role,
  status: user.status || "active",
  photo_face: null,
});

const buildPayload = (form, editing) => {
  const payload = new FormData();
  const role = form.role === "admin"
    ? "admin"
    : ["regional_department", "institution"].includes(form.unit_type)
      ? "regional"
      : "outpost";
  const values = {
    email: form.email.trim(),
    full_name: form.full_name.trim(),
    military_rank: form.military_rank.trim(),
    position: form.position.trim(),
    unit_type: form.unit_type,
    phone: form.phone.trim(),
    region: form.region.trim(),
    outpost_name: role === "outpost" ? form.outpost_name.trim() : "",
    training_center: form.training_center || "",
    platoon_number: form.platoon_number || "",
    role,
    status: form.status,
  };

  Object.entries(values).forEach(([key, value]) => payload.append(key, value));
  if (!editing || form.password.trim()) payload.append("password", form.password);
  if (form.photo_face) payload.append("photo_face", form.photo_face);
  return { payload, role };
};

export default function AdminUsersPage({ onMessageUser, user: currentUser }) {
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [nextOffset,setNextOffset]=useState(null),[totalUsers,setTotalUsers]=useState(0),[loadingMore,setLoadingMore]=useState(false);
  const requestVersion=useRef(0);
  const [newCardIds,setNewCardIds]=useState([]);
  const [activeGroup, setActiveGroup] = useState("outpost");
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRegionalUnit, setSelectedRegionalUnit] = useState(null);
  const [form, setForm] = useState(() => createEmptyForm("outpost"));
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isQuickFormOpen, setIsQuickFormOpen] = useState(false);
  const [quickForm, setQuickForm] = useState({ region: "", outpost_name: "", email: "", password: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const editing = Boolean(form.id);
  const groupUsers = users.filter((user) => user.role === activeGroup);
  const availableUnitNumbers = Array.from(new Set([
    ...MILITARY_UNIT_OPTIONS,
    ...groupUsers.map((user) => String(user.region || "").trim()).filter(Boolean),
  ]));
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase("ru");
  const filteredUsers = groupUsers.filter((user) => {
    if (statusFilter && user.status !== statusFilter) return false;
    if (unitFilter && String(user.region || "") !== unitFilter) return false;
    if (!normalizedSearch) return true;
    return [
      user.full_name,
      user.email,
      user.phone,
      user.military_rank,
      user.position,
      user.region,
      user.outpost_name,
    ].some((value) => String(value || "").toLocaleLowerCase("ru").includes(normalizedSearch));
  });

  const loadUsers = async (silent = false, append = false) => {
    const version=++requestVersion.current;
    if(append)setLoadingMore(true);else if(!silent)setLoading(true);
    setError('');
    try {
      const {data}=await api.get('/auth/admin/users/',{params:{paged:'1',offset:append?nextOffset:0,role:activeGroup,status:statusFilter,unit:unitFilter,search:searchQuery.trim()}});
      if(version!==requestVersion.current)return;
      setNewCardIds(data.results.map(u=>u.id));
      setUsers(current=>append?[...current,...data.results.filter(u=>!current.some(v=>v.id===u.id))]:data.results);
      setNextOffset(data.nextOffset);setTotalUsers(data.count);
    } catch(requestError) { if(version===requestVersion.current)setError(getApiErrorMessage(requestError,'Колдонуучуларды жүктөө мүмкүн болгон жок.')); }
    finally { if(version===requestVersion.current){setLoading(false);setLoadingMore(false);} }
  };
  useEffect(()=>{
    const timer=setTimeout(()=>loadUsers(),250);
    return()=>{clearTimeout(timer);requestVersion.current++;};
  },[activeGroup,statusFilter,unitFilter,searchQuery]);

  const updateField = (event) => {
    const { name, value, files } = event.target;
    setForm((current) => {
      const next = { ...current, [name]: files ? files[0] || null : value };
      if (name === "unit_type") {
        next.training_center = "";
        next.platoon_number = "";
        next.role = ["regional_department", "institution"].includes(value)
          ? "regional"
          : "outpost";
        next.region = isInstitutionSubunit(value) ? "КЖжАККДБ" : "";
        next.outpost_name = value === "cynology" ? "Кинология кызматы" : "";
      }
      if (
        name === "region" &&
        ["outpost", ...Object.keys(namedSubunitLabels)].includes(current.unit_type)
      ) {
        next.outpost_name = "";
      }
      return next;
    });
  };

  const closeForm = () => {
    setForm(createEmptyForm(activeGroup));
    setIsFormOpen(false);
    setError("");
  };

  const openCreateForm = () => {
    setSelectedUser(null);
    setForm(createEmptyForm(activeGroup));
    setMessage("");
    setError("");
    setIsFormOpen(true);
    setIsQuickFormOpen(false);
  };

  const submitQuickUser = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.post("/auth/admin/users/quick/", quickForm);
      setQuickForm({ region: "", outpost_name: "", email: "", password: "" });
      setIsQuickFormOpen(false);
      setActiveGroup("outpost");
      setMessage("Колдонуучу тез кошулду. Ал биринчи киргенде калган маалыматтарын толтурат.");
      await loadUsers();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Колдонуучуну тез кошуу мүмкүн болгон жок."));
    } finally {
      setSaving(false);
    }
  };

  const editUser = (user) => {
    setSelectedUser(null);
    setSelectedRegionalUnit(null);
    setActiveGroup(user.role);
    setForm(toForm(user));
    setMessage("");
    setError("");
    setIsFormOpen(true);
    setIsQuickFormOpen(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const { payload, role } = buildPayload(form, editing);
      if (editing) {
        await api.patch(`/auth/admin/users/${form.id}/`, payload);
        setMessage("Колдонуучу жаңыртылды.");
      } else {
        await api.post("/auth/admin/users/", payload);
        setMessage("Колдонуучу кошулду.");
      }
      setActiveGroup(role);
      setForm(createEmptyForm(role));
      setIsFormOpen(false);
      await loadUsers();
    
      notifySave();
} catch (requestError) {
      notifySave(false);

      setError(getApiErrorMessage(requestError, "Колдонуучуну сактоо мүмкүн болгон жок."));
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (user) => {
    if (!window.confirm(`${user.full_name || user.email} колдонуучусу өчүрүлсүнбү?`)) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.delete(`/auth/admin/users/${user.id}/`);
      setSelectedUser(null);
      setMessage("Колдонуучу өчүрүлдү.");
      await loadUsers();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Колдонуучуну өчүрүү мүмкүн болгон жок."));
    } finally {
      setSaving(false);
    }
  };

  const selectGroup = (role) => {
    setActiveGroup(role);
    setSelectedUser(null);
    setSelectedRegionalUnit(null);
    setForm(createEmptyForm(role));
    setIsFormOpen(false);
    setMessage("");
    setError("");
    setSearchQuery("");
    setStatusFilter("");
    setUnitFilter("");
  };

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
    setUnitFilter("");
  };

  if (selectedUser) {
    const details = [
      ["Аты-жөнү", selectedUser.full_name],
      ["Аскердик наамы", selectedUser.military_rank],
      ["Кызматы", selectedUser.position],
      ["Бөлүкчө", unitLabels[selectedUser.unit_type] || roleLabels[selectedUser.role]],
      ["Аскер бөлүгүнүн номери", selectedUser.region],
      [
        namedSubunitLabels[selectedUser.unit_type] || "Заставанын аталышы",
        selectedUser.outpost_name,
      ],
      ["Окуу борбору", selectedUser.training_center_name],
      ["Телефон", selectedUser.phone],
      ["Email", selectedUser.email],
      ["Статусу", statusLabels[selectedUser.status] || selectedUser.status],
      ["Активдүүлүгү", formatPresence(selectedUser)],
      ["Каттоо датасы", formatDate(selectedUser.date_joined)],
    ].filter(([, value]) => value);
    const avatar = selectedUser.photo_face || selectedUser.avatar;

    return (
      <section className="module-panel admin-user-detail">
        <button className="module-back-button" onClick={() => setSelectedUser(null)} type="button"><T>{"Артка"}</T></button>
        <div className="admin-user-detail__top">
          <div className="admin-user-avatar admin-user-avatar--large">
            {avatar ? <img alt={selectedUser.full_name} src={avatar} /> : <span>{getInitials(selectedUser)}</span>}
          </div>
          <div>
            <h1>{selectedUser.full_name || selectedUser.email}</h1>
            <p>{getUnitName(selectedUser)}</p>
            {(!selectedUser.is_superuser || currentUser?.is_superuser) && <div className="table-actions">
              {selectedUser.role === "outpost" ? (
                <button onClick={() => onMessageUser?.(selectedUser)} type="button"><T>{"Написать"}</T></button>
              ) : null}
              <button onClick={() => editUser(selectedUser)} type="button"><T>{"Өзгөртүү"}</T></button>
              <button className="danger" disabled={saving} onClick={() => deleteUser(selectedUser)} type="button"><T>{"Өчүрүү"}</T></button>
            </div>}
          </div>
        </div>
        <dl className="profile-details admin-user-detail__fields">
          {details.map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
        <section className="profile-documents">
          <h2><T>{"Каттоо файлдары"}</T></h2>
          <div className="profile-documents__grid">
            <figure>
              {selectedUser.photo_face ? (
                <img alt="Колдонуучунун сүрөтү" src={selectedUser.photo_face} />
              ) : <div className="profile-document-placeholder"><T>{"Файл жүктөлгөн жок"}</T></div>}
              <figcaption><T>{"Колдонуучунун сүрөтү"}</T></figcaption>
            </figure>
          </div>
        </section>
      </section>
    );
  }

  if (selectedRegionalUnit) {
    const unitUsers = users
      .filter(
        (user) =>
          ["regional", "outpost"].includes(user.role) &&
          String(user.region || "") === String(selectedRegionalUnit.region)
      )
      .sort((left, right) => {
        if (left.role !== right.role) return left.role === "regional" ? -1 : 1;
        return String(left.outpost_name || left.full_name || left.email).localeCompare(
          String(right.outpost_name || right.full_name || right.email),
          "ru"
        );
      });
    const regionalAccount = unitUsers.find(
      (user) => user.id === selectedRegionalUnit.accountId
    );

    return (
      <section className="module-panel admin-users-page">
        <button
          className="module-back-button"
          onClick={() => setSelectedRegionalUnit(null)}
          type="button"
        ><T>{"Артка"}</T></button>
        <header className="admin-users-page__header">
          <div>
            <h1>{selectedRegionalUnit.region}<T>{" аскер бөлүгү"}</T></h1>
            <p>
              {regionalAccount?.email || selectedRegionalUnit.email}<T>{" · Колдонуучулар:"}</T>{" "}
              {unitUsers.length}
            </p>
          </div>
        </header>
        {message && <p className="dashboard-notice"><T>{message}</T></p>}
        {error && <p className="dashboard-error"><T>{error}</T></p>}
        {unitUsers.length > 0 ? (
          <div className="module-period-list">
            {unitUsers.map((unitUser) => {
              const avatar = unitUser.photo_face || unitUser.avatar;
              return (
                <div className="module-period-row" key={unitUser.id}>
                  <button
                    className={`admin-user-list-card${newCardIds.includes(unitUser.id)?" user-card-enter":""}`}
                style={{"--card-delay":`${Math.max(0,newCardIds.indexOf(unitUser.id))*65}ms`}}
                    onClick={() => setSelectedUser(unitUser)}
                    type="button"
                  >
                    <span className="admin-user-avatar">
                      {avatar ? (
                        <img alt="" src={avatar} />
                      ) : (
                        <span>{getInitials(unitUser)}</span>
                      )}
                    </span>
                    <span className="admin-user-list-card__text">
                      <strong>{unitUser.full_name || unitUser.email}</strong>
                      <small>
                        <T>{getUserTypeLabel(unitUser)}</T> · {unitUser.email}
                      </small>
                      {unitUser.role === "outpost" ? (
                        <small>{unitUser.unit_type === "outpost" ? formatOutpostName(unitUser.outpost_name) : unitUser.outpost_name}</small>
                      ) : null}
                      <small className={unitUser.isOnline ? "user-presence is-online" : "user-presence"}>
                        {formatPresence(unitUser)}
                      </small>
                    </span>
                    <span aria-hidden="true" className="admin-user-list-card__arrow">
                      ›
                    </span>
                  </button>
                  <div className="module-period-actions">
                    <button
                      className="danger"
                      disabled={saving}
                      onClick={() => deleteUser(unitUser)}
                      type="button"
                    ><T>{"Өчүрүү"}</T></button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="dashboard-state">
            {selectedRegionalUnit.region}<T>{" номериндеги колдонуучулар табылган жок."}</T></p>
        )}
      </section>
    );
  }

  return (
    <section className="module-panel admin-users-page">
      <header className="admin-users-page__header">
        <div><h1><T>{"Колдонуучулар"}</T></h1><p><T>{"Администраторлор, заставалар жана аскер бөлүктөрү."}</T></p></div>
        <div className="admin-users-page__header-actions">
          <button onClick={() => {
            setIsQuickFormOpen((current) => !current);
            setIsFormOpen(false);
            setError("");
          }} type="button"><T>{"Тез кошуу"}</T></button>
          <button onClick={openCreateForm} type="button"><T>{"Кошуу"}</T></button>
        </div>
      </header>

      {isQuickFormOpen && (
        <form className="admin-quick-user-form" onSubmit={submitQuickUser}>
          <h2><T>{"Колдонуучуну тез кошуу"}</T></h2>
          <label><T>{"Аскер бөлүгүнүн номери"}</T><select
              required
              value={quickForm.region}
              onChange={(event) => setQuickForm((current) => ({ ...current, region: event.target.value, outpost_name: "" }))}
            >
              <option disabled value=""><T>{"Тандаңыз"}</T></option>
              {OUTPOST_MILITARY_UNIT_OPTIONS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
            </select>
          </label>
          <label><T>{"Заставанын аталышы"}</T><select
              disabled={!quickForm.region}
              required
              value={quickForm.outpost_name}
              onChange={(event) => setQuickForm((current) => ({ ...current, outpost_name: event.target.value }))}
            >
              <option disabled value=""><T>{"Тандаңыз"}</T></option>
              {(OUTPOSTS_BY_MILITARY_UNIT[quickForm.region] || []).map(([number, name]) => (
                <option key={`${number}-${name}`} value={formatOutpostName(name)}>{number}. {formatOutpostName(name)}</option>
              ))}
            </select>
          </label>
          <label>Email<input required type="email" value={quickForm.email} onChange={(event) => setQuickForm((current) => ({ ...current, email: event.target.value }))} /></label>
          <label><T>{"Сырсөз"}</T><input minLength={8} required type="password" value={quickForm.password} onChange={(event) => setQuickForm((current) => ({ ...current, password: event.target.value }))} /></label>
          <div className="admin-user-form__actions">
            <button disabled={saving} type="submit"><T>{saving ? "Кошулууда..." : "Тез кошуу"}</T></button>
            <button disabled={saving} onClick={() => setIsQuickFormOpen(false)} type="button"><T>{"Жокко чыгаруу"}</T></button>
          </div>
        </form>
      )}

      <div className="admin-users-page__tabs" role="tablist" aria-label={t("Колдонуучунун түрү")} style={{ "--role-index": ["outpost", "regional", "admin"].indexOf(activeGroup) }}>
        {[
          ["outpost", "Застава", "M5 3 21 10 5 17Z"],
          ["regional", "Аскер бөлүгү", "M5 5H22L17 13H5Z"],
          ["admin", "Администратор", "M5 3C10 3 14 4 16 8C17 10 20 11 21 15C21.5 18 23 20 24 21C17 21 14 17 10 17C8 17 6.5 17.4 5 18Z"],
        ].map(([role, label, path], index) => <button key={role} aria-selected={activeGroup === role} tabIndex={activeGroup === role ? 0 : -1} className={activeGroup === role ? "active" : ""} onClick={() => selectGroup(role)} role="tab" type="button" onKeyDown={(event) => {
          const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
          if (!direction && !["Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? 2 : (index + direction + 3) % 3;
          selectGroup(["outpost", "regional", "admin"][next]);
          event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus();
        }}><svg className={`role-flag role-flag--${role}`} viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path className="role-flag__cloth" d={path} /><path d="M5 3V23" /></svg><span><T>{label}</T></span></button>)}
      </div>

      {isFormOpen && (
        <form className="admin-user-form admin-user-registration-form" encType="multipart/form-data" onSubmit={submit}>
          <h2><T>{editing ? "Колдонуучуну өзгөртүү" : "Колдонуучуну кошуу"}</T></h2>
          <label><T>{"Аты-жөнү"}</T><input name="full_name" required value={form.full_name} onChange={updateField} /></label>
          <label><T>{"Аскердик наамы"}</T><input name="military_rank" required value={form.military_rank} onChange={updateField} /></label>
          <label><T>{"Кызматы"}</T><input name="position" required value={form.position} onChange={updateField} /></label>
          {form.role !== "admin" && <label><T>{"Бөлүкчө"}</T><select name="unit_type" required value={form.unit_type} onChange={updateField}>
              <option value="outpost"><T>{"Застава"}</T></option>
              <option value="checkpoint"><T>{"КӨП"}</T></option>
              <option value="regional_department"><T>{"Аскер бөлүгү"}</T></option>
              <option value="detachment"><T>{"Отряд"}</T></option>
              <option value="group"><T>{"Топ"}</T></option>
              <option value="company"><T>{"Рота"}</T></option>
              <option value="platoon"><T>{"Взвод"}</T></option>
              <option value="institution"><T>{"КЖжАККДБ"}</T></option>
          <option value="cynology"><T>{"Кинология кызматы"}</T></option>
          <option value="course_head"><T>{"Курстун бачысы"}</T></option>
          <option value="training_center_head"><T>{"Окуу борбордун башчысы"}</T></option>
          <option value="training_platoon_commander"><T>{"Окуу взводдун командири"}</T></option>
            </select>
          </label>}
          {form.role !== "admin" && !isInstitutionSubunit(form.unit_type) && !isTrainingUnit(form.unit_type) && <label><T>{"Аскер бөлүгүнүн номери"}</T><select className={!form.region ? "form-select-placeholder" : undefined} name="region" required value={form.region} onChange={updateField}>
              <option disabled value=""><T>{"Аскер бөлүгүнүн номерин тандаңыз"}</T></option>
              {(form.unit_type === "outpost" ? OUTPOST_MILITARY_UNIT_OPTIONS : MILITARY_UNIT_OPTIONS).map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </label>}
          <TrainingUnitFields form={form} setForm={setForm} />
          {form.unit_type === "outpost" && (
            <label><T>{"Заставанын аталышы"}</T><select
                className={!form.outpost_name ? "form-select-placeholder" : undefined}
                disabled={!form.region}
                name="outpost_name"
                required
                value={form.outpost_name}
                onChange={updateField}
              >
                <option disabled value="">
                  <T>{form.region ? "Заставанын аталышын тандаңыз" : "Алгач аскер бөлүгүнүн номерин тандаңыз"}</T>
                </option>
                {(OUTPOSTS_BY_MILITARY_UNIT[form.region] || []).map(([number, name]) => (
                  <option key={`${number}-${name}`} value={formatOutpostName(name)}>
                    {number}. {formatOutpostName(name)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {namedSubunitLabels[form.unit_type] && form.region && (
            <label>
              {namedSubunitLabels[form.unit_type]}
              <input
                name="outpost_name"
                required
                value={form.outpost_name}
                onChange={updateField}
              />
            </label>
          )}
          <label><T>{"Телефон"}</T><input name="phone" pattern="^\+996\d{9}$" placeholder="+996XXXXXXXXX" required value={form.phone} onChange={updateField} /></label>
          <label>Email<input name="email" required type="email" value={form.email} onChange={updateField} /></label>
          <label><T>{"Сырсөз"}</T><input name="password" minLength={8} required={!editing} type="password" value={form.password} onChange={updateField} />
            {editing && <small><T>{"Сырсөздү өзгөртпөө үчүн бош калтырыңыз."}</T></small>}
          </label>
          <label><T>{"Колдонуучунун сүрөтү"}</T><input accept="image/*" name="photo_face" required={!editing} type="file" onChange={updateField} />
          </label>
          {editing && (
            <label><T>{"Статусу"}</T><select name="status" value={form.status} onChange={updateField}><option value="active"><T>{"Активдүү"}</T></option><option value="pending"><T>{"Күтүүдө"}</T></option><option value="rejected"><T>{"Четке кагылган"}</T></option></select></label>
          )}
          <div className="admin-user-form__actions">
            <button disabled={saving} type="submit"><T>{saving ? "Сакталууда..." : editing ? "Сактоо" : "Кошуу"}</T></button>
            <button disabled={saving} onClick={closeForm} type="button"><T>{"Жокко чыгаруу"}</T></button>
          </div>
        </form>
      )}

      <div className="admin-user-search-filters">
        <label className="admin-user-search-filters__search">
          <span><T>{"Издөө"}</T></span>
          <input
            aria-label={t("Колдонуучуларды издөө")}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("Аты-жөнү, электрондук почта, телефон, наам, застава...")}
            type="search"
            value={searchQuery}
          />
        </label>
        <label>
          <span><T>{"Статусу"}</T></span>
          <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
            <option value=""><T>{"Бардык статустар"}</T></option>
            <option value="active"><T>{"Активдүү"}</T></option>
            <option value="pending"><T>{"Күтүүдө"}</T></option>
            <option value="rejected"><T>{"Четке кагылган"}</T></option>
          </select>
        </label>
        {activeGroup !== "admin" && <label>
          <span><T>{"Аскер бөлүгүнүн номери"}</T></span>
          <select onChange={(event) => setUnitFilter(event.target.value)} value={unitFilter}>
            <option value=""><T>{"Бардык аскер бөлүктөр"}</T></option>
            {availableUnitNumbers.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
          </select>
        </label>}
        {(searchQuery || statusFilter || unitFilter) && (
          <button onClick={resetFilters} type="button"><T>{"Тазалоо"}</T></button>
        )}
      </div>

      {message && <p className="dashboard-notice"><T>{message}</T></p>}
      {error && <p className="dashboard-error"><T>{error}</T></p>}
      {loading && <div className="admin-user-card-list" role="status" aria-label={t("Колдонуучулар жүктөлүүдө...")}>{[0,1,2].map(i=><div className="user-card-skeleton" key={i} aria-hidden="true"><span/><div><i/><i/><i/></div></div>)}</div>}
      {!loading && !error && filteredUsers.length === 0 && (
        <p className="dashboard-state">
          <T>{groupUsers.length === 0 ? "Колдонуучулар азырынча жок." : "Берилген шарттар боюнча колдонуучулар табылган жок."}</T>
        </p>
      )}
      {!loading && !error && filteredUsers.length > 0 && (
        <p className="admin-user-search-result"><T>{"Табылды: "}</T>{totalUsers}</p>
      )}
      {!loading && filteredUsers.length > 0 && (
        <div className="admin-user-card-list">
          {filteredUsers.map((user) => {
            const avatar = user.photo_face || user.avatar;
            return (
              <button
                className={`admin-user-list-card${newCardIds.includes(user.id)?" user-card-enter":""}`}
                style={{"--card-delay":`${Math.max(0,newCardIds.indexOf(user.id))*65}ms`}}
                key={user.id}
                onClick={() =>
                  activeGroup === "regional"
                    ? setSelectedRegionalUnit({
                        accountId: user.id,
                        email: user.email,
                        region: user.region,
                      })
                    : setSelectedUser(user)
                }
                type="button"
              >
                <span className="admin-user-avatar">
                  {avatar ? <img alt="" src={avatar} /> : <span>{getInitials(user)}</span>}
                </span>
                <span className="admin-user-list-card__text">
                  <strong>{user.full_name || user.email}</strong>
                  <small>{getUnitName(user)}</small>
                  <small className={user.isOnline ? "user-presence is-online" : "user-presence"}>
                    {formatPresence(user)}
                  </small>
                </span>
                <span aria-hidden="true" className="admin-user-list-card__arrow">›</span>
              </button>
            );
          })}
        </div>
      )}
      {loadingMore&&<div className="admin-user-card-list" role="status" aria-label={t("Жүктөлүүдө...")}>{[0,1].map(i=><div className="user-card-skeleton" key={i} aria-hidden="true"><span/><div><i/><i/><i/></div></div>)}</div>}
      {nextOffset!==null&&!loading&&<button type="button" className="module-action-button" disabled={loadingMore} onClick={()=>loadUsers(false,true)}>{loadingMore?t("Жүктөлүүдө..."):t("Дагы 10 көрсөтүү")}</button>}
    </section>
  );
}
