import { notifySave } from "../../../utils/saveFeedback.js";
import { T } from "../../../i18n.jsx";
import TrainingUnitFields from "../../TrainingUnitFields.jsx";
import { isInstitutionSubunit, isTrainingUnit } from "../../../data/unitTypes.js";
import React, { useState } from "react";
import { useDispatch } from "react-redux";

import { api } from "../../../api/client.js";
import { getApiErrorMessage } from "../../../api/errors.js";
import {
  MILITARY_UNIT_OPTIONS,
  OUTPOST_MILITARY_UNIT_OPTIONS,
  OUTPOSTS_BY_MILITARY_UNIT,
  formatOutpostName,
} from "../../../data/militaryUnits.js";
import { updateUser } from "../../../features/auth/authSlice.js";

const namedSubunitLabels = {
  subdivision: "Бөлүмчөнүн аталышы",
  checkpoint: "Көзөмөл өткөрмө пунктунун аталышы",
  detachment: "Отрядтын аталышы",
  group: "Топтун аталышы",
  company: "Ротанын аталышы",
  platoon: "Взводдун аталышы",
  course_head: "Курстун аталышы",
};

export default function ProfileEditForm({ user, requiredCompletion = false, onCancel, onSaved }) {
  const dispatch = useDispatch();
  const [form, setForm] = useState({
    email: user?.email || "",
    password: "",
    full_name: user?.full_name || "",
    military_rank: user?.military_rank || "",
    position: user?.position || "",
    unit_type: user?.unit_type || "outpost",
    phone: user?.phone || "",
    region: user?.region || "",
    outpost_name: user?.outpost_name || "",
    training_center: user?.training_center || "",
    platoon_number: user?.platoon_number || "",
    photo_face: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateField = (event) => {
    const { name, value, files } = event.target;
    setForm((current) => {
      const next = { ...current, [name]: files ? files[0] || null : value };
      if (name === "unit_type") {
        next.training_center = "";
        next.platoon_number = "";
        if (isTrainingUnit(value) || isTrainingUnit(current.unit_type)) {
          next.region = "";
          next.outpost_name = "";
        }
        if (isInstitutionSubunit(value)) {
          next.region = "КЖжАККДБ";
          next.outpost_name = value === "cynology" ? "Кинология кызматы" : "";
        } else if (isInstitutionSubunit(current.unit_type)) {
          next.region = "";
          next.outpost_name = "";
        }
      }
      return next;
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (user?.role === "admin" && ["unit_type", "region", "outpost_name"].includes(key)) return;
        if (key === "photo_face") {
          if (value) payload.append(key, value);
        } else if (key !== "password" || value) {
          payload.append(key, String(value ?? "").trim());
        }
      });
      if (requiredCompletion) payload.append("complete_profile", "true");

      // Log what's being sent for debugging
      console.log("Submitting profile update:", Object.fromEntries(payload));

      const { data } = await api.patch("/auth/me/", payload);
      dispatch(updateUser(data));
      onSaved?.(data);
    
      notifySave();
} catch (requestError) {
      notifySave(false);

      console.error("Profile update error:", requestError);
      setError(getApiErrorMessage(requestError, "Профилди сактоо мүмкүн болгон жок."));
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = user?.role === "admin";
  const unitOptions = form.unit_type === "outpost" ? OUTPOST_MILITARY_UNIT_OPTIONS : MILITARY_UNIT_OPTIONS;

  return (
    <form className="profile-edit-form" encType="multipart/form-data" onSubmit={submit}>
      {error ? <p className="dashboard-error"><T>{error}</T></p> : null}
      <label><T>{"Аты-жөнү"}</T><input name="full_name" onChange={updateField} required value={form.full_name} /></label>
      <label><T>{"Аскердик наамы"}</T><input name="military_rank" onChange={updateField} required={requiredCompletion} value={form.military_rank} /></label>
      <label><T>{"Кызматы"}</T><input name="position" onChange={updateField} required={requiredCompletion} value={form.position} /></label>
      {!isAdmin ? <label><T>{"Бөлүкчө"}</T><select name="unit_type" onChange={updateField} required={requiredCompletion && !user?.unit_type} value={form.unit_type}>
          <option value="outpost"><T>{"Застава"}</T></option>
            <option value="subdivision"><T>{"Бөлүмчө"}</T></option>
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
      </label> : null}
      {!isAdmin && !isInstitutionSubunit(form.unit_type) && !isTrainingUnit(form.unit_type) ? <label><T>{"Аскер бөлүгүнүн номери"}</T><select name="region" onChange={updateField} required={requiredCompletion && !user?.region} value={form.region}>
          <option disabled value=""><T>{"Тандаңыз"}</T></option>
          {unitOptions.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
        </select>
      </label> : null}
      {!isAdmin ? <TrainingUnitFields form={form} setForm={setForm} /> : null}
      {form.unit_type === "outpost" && !isAdmin ? <label><T>{"Заставанын аталышы"}</T><select disabled={!form.region} name="outpost_name" onChange={updateField} required={requiredCompletion && !user?.outpost_name} value={form.outpost_name}>
          <option disabled value=""><T>{"Тандаңыз"}</T></option>
          {(OUTPOSTS_BY_MILITARY_UNIT[form.region] || []).map(([number, name]) => (
            <option key={`${number}-${name}`} value={name}>{number}. {formatOutpostName(name)}</option>
          ))}
        </select>
      </label> : null}
      {namedSubunitLabels[form.unit_type] && !isAdmin ? <label>
        {namedSubunitLabels[form.unit_type]}
        <input name="outpost_name" onChange={updateField} required={form.unit_type === "course_head" || (requiredCompletion && !user?.outpost_name)} value={form.outpost_name} />
      </label> : null}
      <label><T>{"Телефон"}</T><input name="phone" onChange={updateField} pattern="^\+996\d{9}$" placeholder="+996XXXXXXXXX" required={requiredCompletion} value={form.phone} /></label>
      <label>Email<input name="email" onChange={updateField} required type="email" value={form.email} /></label>
      <label><T>{"Жаңы сырсөз"}</T><input autoComplete="new-password" minLength={8} name="password" onChange={updateField} type="password" value={form.password} />
        <small><T>{"Өзгөртпөсөңүз бош калтырыңыз."}</T></small>
      </label>
      <label><T>{"Колдонуучунун сүрөтү"}</T><input accept="image/*" name="photo_face" onChange={updateField} required={requiredCompletion && !user?.photo_face} type="file" />
      </label>
      <div className="admin-user-form__actions">
        <button disabled={saving} type="submit"><T>{saving ? "Сакталууда..." : "Сактоо"}</T></button>
        {onCancel ? <button disabled={saving} onClick={onCancel} type="button"><T>{"Жокко чыгаруу"}</T></button> : null}
      </div>
    </form>
  );
}
