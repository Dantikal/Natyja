import { T, useLanguage } from "../../i18n.jsx";
import React from "react";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { login } from "./authSlice.js";

export default function LoginPage({ onLoggedIn }) {
  const { t } = useLanguage();
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.auth);
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  const updateField = (event) => {
    const { name, value } = event.target;
    setCredentials((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const action = await dispatch(login(credentials));

    if (login.fulfilled.match(action)) {
      onLoggedIn?.();
    }
  };

  return (
    <section className="panel narrow">
      <h1><T>{"Кирүү"}</T></h1>
      <form className="form-grid single-column" onSubmit={submit}>
        <label><T>{"Электрондук почта"}</T><input
            autoComplete="email"
            name="email"
            required
            type="email"
            value={credentials.email}
            onChange={updateField}
          />
        </label>
        <label><T>{"Сырсөз"}</T><span className="password-input">
            <input
              autoComplete="current-password"
              name="password"
              required
              type={showPassword ? "text" : "password"}
              value={credentials.password}
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
        <button disabled={loading} type="submit">
          <T>{loading ? "Кирүүдө..." : "Кирүү"}</T>
        </button>
      </form>
      {error && <p className="error"><T>{error}</T></p>}
    </section>
  );
}
