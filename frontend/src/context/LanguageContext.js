import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations } from '../i18n/translations';
import { phrases } from '../i18n/phrases';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('lang') === 'ky' ? 'ky' : 'ru';
  });

  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  function toggleLang() {
    setLang((prev) => (prev === 'ru' ? 'ky' : 'ru'));
  }

  const t = useCallback((key) => {
    return translations[lang]?.[key] || translations.ru[key] || key;
  }, [lang]);

  const tr = useCallback((text) => lang === 'ky' ? (phrases[text] || text) : text, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t, tr }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);
