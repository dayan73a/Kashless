// src/context/I18nContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
// 🔒 Import explícito al index.js de la carpeta i18n, solo named export
import { dict as DICT } from "../i18n/index.js";

const I18nContext = createContext({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
  ready: true,
});

// Normaliza cualquier variante a "en" o "es"
function normalizeLang(raw) {
  const v = String(raw || "").toLowerCase().trim();
  if (v.startsWith("es")) return "es";             // es, es-es, ES...
  if (v.startsWith("en") || v === "us") return "en"; // en, en-us, US...
  return "en";
}

export function I18nProvider({ children }) {
  const [lang, setLangRaw] = useState(() => {
    try {
      const saved = localStorage.getItem("kashless_lang");
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
      const table = DICT?.[lang] || DICT?.en || DICT?.es || {};
      // Aviso útil en dev si faltan claves o está mal el dict
      if (import.meta?.env?.DEV && !Object.keys(table).length) {
        console.warn(`[i18n] Empty dict for lang="${lang}". Available langs: ${Object.keys(DICT || {}).join(", ")}`);
      }
      const out = String(key || "")
        .split(".")
        .reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), table);
      if (out === undefined) {
        if (import.meta?.env?.DEV) console.warn(`[i18n] Missing key "${key}" for lang "${lang}"`);
        return key;
      }
      return out;
    };
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t, ready: true }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
