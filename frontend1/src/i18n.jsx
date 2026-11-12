import React, { createContext, useContext, useEffect, useState } from "react";
import { translate } from "./translations.js";

const LanguageContext = createContext(null);
export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    try { return localStorage.getItem("munara:language") === "ru" ? "ru" : "ky"; } catch { return "ky"; }
  });
  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem("munara:language", language); } catch { /* Keep selection for this visit. */ }
  }, [language]);
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}
export function useLanguage() {
  const context = useContext(LanguageContext);
  return { ...context, t: (text) => translate(text, context?.language || "ky") };
}
export function T({ children }) {
  const { t } = useLanguage();
  return <>{t(children)}</>;
}
export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  return <div className="language-switcher" role="group" aria-label="Тил / Язык">
    <button type="button" lang="ky" aria-pressed={language === "ky"} onClick={() => setLanguage("ky")}>КЫР</button>
    <button type="button" lang="ru" aria-pressed={language === "ru"} onClick={() => setLanguage("ru")}>РУС</button>
  </div>;
}
