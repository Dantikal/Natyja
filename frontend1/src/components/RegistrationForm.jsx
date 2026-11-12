import { T, useLanguage } from "../i18n.jsx";
import TrainingUnitFields from "./TrainingUnitFields.jsx";
import { isInstitutionSubunit, isTrainingUnit } from "../data/unitTypes.js";
import React from "react";
import { useState } from "react";

import { api } from "../api/client.js";
import { getApiErrorMessage } from "../api/errors.js";
import {
  MILITARY_UNIT_OPTIONS,
  OUTPOST_MILITARY_UNIT_OPTIONS,
  OUTPOSTS_BY_MILITARY_UNIT,
  formatOutpostName,
} from "../data/militaryUnits.js";

const initialForm = {
  full_name: "",
  military_rank: "",
  position: "",
  unit_type: "",
  phone: "",
  email: "",
  password: "",
  region: "",
  outpost_name: "",
  training_center: "",
  platoon_number: "",
  photo_face: null,
};

const namedSubunitLabels = {
  subdivision: "Бөлүмчөнүн аталышы",
  checkpoint: "Көзөмөл өткөрмө пунктунун аталышы",
  detachment: "Отрядтын аталышы",
  group: "Топтун аталышы",
  company: "Ротанын аталышы",
  platoon: "Взводдун аталышы",
  course_head: "Курстун аталышы",
};

export default function RegistrationForm() {
  const { t, language } = useLanguage();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const namedSubunitLabel = namedSubunitLabels[form.unit_type];
  const isNamedSubunit = Boolean(namedSubunitLabel);

  const updateField = (event) => {
    const { name, value, files } = event.target;
    setForm((current) => {
      const nextForm = {
        ...current,
        [name]: files ? files[0] : value,
      };

      if (name === "unit_type") {
        nextForm.training_center = "";
        nextForm.platoon_number = "";
        nextForm.region = isInstitutionSubunit(value) ? "КЖжАККДБ" : "";
        nextForm.outpost_name = value === "cynology" ? "Кинология кызматы" : "";
      }

      if (
        name === "region" &&
        ["outpost", ...Object.keys(namedSubunitLabels)].includes(current.unit_type)
      ) {
        nextForm.outpost_name = "";
      }

      return nextForm;
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setLoading(true);
    setMessage("");
    setError("");

    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value !== null && value !== "") {
        payload.append(key, value);
      }
    });

    try {
      const { data } = await api.post("/auth/register/", payload);
      setMessage(data.message);
      setForm(initialForm);
      setShowPassword(false);
      formElement.reset();
    } catch (err) {
      setError(getApiErrorMessage(err, "Каттоо учурунда серверде ката кетти. Кийинчерээк кайра аракет кылыңыз."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel">
      <h1><T>{"Кирүү мүмкүнчүлүгүнө каттоо"}</T></h1>
      <form className="form-grid" onSubmit={submit}>
        <label><T>{"Аты-жөнү"}</T><input name="full_name" required onChange={updateField} />
        </label>
        <label><T>{"Аскердик наамы"}</T><input name="military_rank" required onChange={updateField} />
        </label>
        <label><T>{"Кызматы"}</T><input name="position" required onChange={updateField} />
        </label>
        <label><T>{"Бөлүкчө"}</T><select
            name="unit_type"
            required
            value={form.unit_type}
            onChange={updateField}
          >
            <option value=""><T>{"Бөлүкчөнү тандаңыз"}</T></option>
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
        </label>
        <TrainingUnitFields form={form} setForm={setForm} />
        {form.unit_type === "outpost" && (
          <>
            <label><T>{"Аскер бөлүгүнүн номери"}</T><select
                className={!form.region ? "form-select-placeholder" : undefined}
                name="region"
                required
                value={form.region}
                onChange={updateField}
              >
                <option disabled value=""><T>{"Аскер бөлүгүнүн номерин тандаңыз"}</T></option>
                {OUTPOST_MILITARY_UNIT_OPTIONS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>
            <label><T>{"Заставанын аталышы"}</T><select
                className={!form.outpost_name ? "form-select-placeholder" : undefined}
                name="outpost_name"
                required
                value={form.outpost_name}
                onChange={updateField}
                disabled={!form.region}
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
          </>
        )}
        {["regional_department", "institution"].includes(form.unit_type) && (
          <label><T>{"Аскер бөлүгүнүн номери"}</T><select
              className={!form.region ? "form-select-placeholder" : undefined}
              name="region"
              required
              value={form.region}
              onChange={updateField}
            >
              <option disabled value=""><T>{"Аскер бөлүгүн тандаңыз"}</T></option>
              {MILITARY_UNIT_OPTIONS.map((unit) => (
                <option key={unit} value={unit}>
                  <T>{/^[0-9]+$/.test(unit) ? `${unit} аскер бөлүгү` : unit}</T>
                </option>
              ))}
            </select>
          </label>
        )}
        {isNamedSubunit && !isInstitutionSubunit(form.unit_type) && (
          <>
            <label><T>{"Аскер бөлүгүнүн номери"}</T><select
                className={!form.region ? "form-select-placeholder" : undefined}
                name="region"
                required
                value={form.region}
                onChange={updateField}
              >
                <option disabled value=""><T>{"Аскер бөлүгүнүн номерин тандаңыз"}</T></option>
                {MILITARY_UNIT_OPTIONS.map((unit) => (
                  <option key={unit} value={unit}>
                    <T>{/^[0-9]+$/.test(unit) ? `${unit} аскер бөлүгү` : unit}</T>
                  </option>
                ))}
              </select>
            </label>
            {form.region && (
              <label>
                <T>{namedSubunitLabel}</T>
                <input
                  name="outpost_name"
                  required
                  value={form.outpost_name}
                  onChange={updateField}
                />
              </label>
            )}
          </>
        )}
        {form.unit_type === "course_head" && (
          <label><T>{"Курстун аталышы"}</T><input name="outpost_name" required value={form.outpost_name} onChange={updateField} />
          </label>
        )}
        <label><T>{"Телефон"}</T><input
            name="phone"
            required
            value={form.phone}
            onChange={updateField}
          />
        </label>
        <label><T>{"Электрондук почтасы"}</T><input name="email" type="email" required onChange={updateField} />
        </label>
        <label><T>{"Сырсөз"}</T><span className="password-input">
            <input
              autoComplete="new-password"
              name="password"
              type={showPassword ? "text" : "password"}
              minLength={8}
              required
              value={form.password}
              onChange={updateField}
            />
            <button
              aria-label={t(showPassword ? "Сырсөздү жашыруу" : "Сырсөздү көрсөтүү")}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((current) => !current)}
              type="button"
            >
              <T>{showPassword ? "Жашыруу" : "Көрсөтүү"}</T>
            </button>
          </span>
        </label>
        <label className="registration-photo"><T>{"Колдонуучунун сүрөтү"}</T><span className="registration-photo-picker"><span className="registration-photo-button">{language === "ru" ? "Выбрать фото" : "Сүрөт тандоо"}</span><span className="registration-photo-name">{form.photo_face?.name || (language === "ru" ? "Фото не выбрано" : "Сүрөт тандалган жок")}</span><input
            name="photo_face"
            type="file"
            accept="image/*"
            required
            onChange={updateField}
          /></span>
        </label>
        <button disabled={loading} type="submit">
          <T>{loading ? "Жөнөтүлүүдө..." : "Өтүнмө жөнөтүү"}</T>
        </button>
      </form>
      {message && <p className="success"><T>{message}</T></p>}
      {error && <p className="error"><T>{error}</T></p>}
    </section>
  );
}
