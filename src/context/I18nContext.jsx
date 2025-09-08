// src/context/I18nContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
// Importa el diccionario (debe existir: src/i18n/index.js exporta named `dict`)
import { dict as DICT } from "../i18n/index.js";

const I18nContext = createContext({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
  ready: true,
});

// Normaliza a "en" o "es"
function normalizeLang(raw) {
  const v = String(raw || "").toLowerCase().trim();
  if (v.startsWith("es")) return "es";
  if (v.startsWith("en") || v === "us") return "en";
  return "en";
}

export function I18nProvider({ children }) {
  const [lang, setLangRaw] = useState(() => {
    try {
      const saved = typeof localStorage !== "undefined" ? localStorage.getItem("kashless_lang") : null;
      return normalizeLang(saved || "en");
    } catch {
      return "en";
    }
  });

  const setLang = (next) => setLangRaw(normalizeLang(next));

  useEffect(() => {
    try { localStorage.setItem("kashless_lang", lang); } catch {}
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", lang);
    }
  }, [lang]);

  const t = useMemo(() => {
    return (key) => {
      const table = (DICT && (DICT[lang] || DICT.en || DICT.es)) || {};
      // Búsqueda segura por rutas "a.b.c"
      const out = String(key || "")
        .split(".")
        .reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), table);
      return out === undefined ? key : out;
    };
  }, [lang]);

  // ready siempre true para no bloquear la app
  const value = useMemo(() => ({ lang, setLang, t, ready: true }), [lang, t]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
