import {useLanguage as useCopyLanguage} from "../../../i18n.jsx";
import { T } from "../../../i18n.jsx";
import { getUserTypeLabel, unitLabels } from "../../../data/unitTypes.js";
import React, { useState } from "react";
import { useDispatch } from "react-redux";

import { api } from "../../../api/client.js";
import { getApiErrorMessage } from "../../../api/errors.js";
import { updateUser } from "../../../features/auth/authSlice.js";
import ProfileEditForm from "./ProfileEditForm.jsx";

const statusLabels = {
  active: "Активдүү",
  pending: "Күтүүдө",
  rejected: "Четке кагылган",
};

const namedSubunitLabels = {
  subdivision: "Бөлүмчөнүн аталышы",
  checkpoint: "Көзөмөл өткөрмө пунктунун аталышы",
  detachment: "Отрядтын аталышы",
  group: "Топтун аталышы",
  company: "Ротанын аталышы",
  platoon: "Взводдун аталышы",
  training_center_head: "Окуу борбордун аталышы",
  training_platoon_commander: "Окуу взводу",
  course_head: "Курстун аталышы",
  cynology: "Бөлүкчө",
};

const getInitials = (user) => {
  const source = user?.full_name || user?.email || "Колдонуучу";
  return source
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
};

export default function Profile({ user }) {
 const {t:copyT}=useCopyLanguage();

  const dispatch = useDispatch();
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const avatarSrc = user?.photo_face || user?.avatar;

  const registrationRows = [
    ["Аты-жөнү", user?.full_name],
    ["Аскердик наамы", user?.military_rank],
    ["Кызматы", user?.position],
    ["Бөлүкчө", unitLabels[user?.unit_type] || user?.unit_type],
    ["Аскер бөлүк", user?.region],
    [
      namedSubunitLabels[user?.unit_type] || "Застава",
      user?.outpost_name,
    ],
    ["Окуу борбору", user?.training_center_name],
    ["Телефон номери", user?.phone],
    ["Электрондук почтасы", user?.email],
    ["Ролу", getUserTypeLabel(user)],
    ["Статусу", statusLabels[user?.status] || user?.status],
    ["Каттоо датасы", user?.date_joined],
  ].filter(([, value]) => value);

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const payload = new FormData();
    payload.append("photo_face", file);
    setUploading(true);
    setMessage("");
    setError("");

    try {
      const { data } = await api.patch("/auth/me/", payload);
      dispatch(updateUser(data));
      setMessage("Сүрөт жаңыртылды.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Сүрөттү жаңыртуу мүмкүн болгон жок."));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <section className="module-panel profile-panel">
      <header>
        <div>
          <h1><T>{"Жеке кабинетим"}</T></h1>
          <p><T>{"Системанын учурдагы колдонуучусунун маалыматы."}</T></p>
        </div>
        <button onClick={() => setEditing((current) => !current)} type="button">
          <T>{editing ? "Жабуу" : "Профилди өзгөртүү"}</T>
        </button>
      </header>
      {editing ? (
        <ProfileEditForm user={user} onCancel={() => setEditing(false)} onSaved={() => {
          setEditing(false);
          setMessage("Профиль сакталды.");
        }} />
      ) : null}
      <div className="profile-layout">
        <div className="profile-avatar profile-avatar--large">
          {avatarSrc ? (
            <img alt={user.full_name || user.email} src={avatarSrc} />
          ) : (
            <span>{getInitials(user)}</span>
          )}
        </div>
        <div className="profile-main">
          <label className="avatar-upload">
            <input accept="image/*" type="file" onChange={uploadAvatar} />
            <span><T>{uploading ? "Жүктөлүүдө..." : "Сүрөт коюу"}</T></span>
          </label>
          {message && <p className="success"><T>{message}</T></p>}
          {error && <p className="error"><T>{error}</T></p>}
          <h2 className="profile-section-title"><T>{"Каттоо талаасы"}</T></h2>
          <dl className="profile-details">
            {registrationRows.map(([label, value]) => (
              <div key={label}>
                <dt><T>{label}</T></dt>
                <dd>{["Бөлүкчө", "Ролу", "Статусу"].includes(label) ? <T>{value}</T> : value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <section className="profile-documents">
        <h2><T>{"Каттоо файлдары"}</T></h2>
        <div className="profile-documents__grid">
          <figure>
            {user?.photo_face ? (
              <img alt={copyT("Каттоодогу колдонуучунун сүрөтү")} src={user.photo_face} />
            ) : (
              <div className="profile-document-placeholder"><T>{"Файл жүктөлгөн жок"}</T></div>
            )}
            <figcaption><T>{"Колдонуучунун сүрөтү"}</T></figcaption>
          </figure>
        </div>
      </section>
    </section>
  );
}
