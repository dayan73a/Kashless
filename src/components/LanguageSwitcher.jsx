// src/components/LanguageSwitcher.jsx
import React from "react";
import { useLocation } from "react-router-dom";
import { useI18n } from "../context/I18nContext.jsx";

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  const { pathname } = useLocation();

  // No mostrar en la pantalla de selección
  if (pathname === "/language") return null;

  const next = lang === "es" ? "en" : "es";
  const label =
    lang === "es" ? "🇪🇸 ES" : lang === "en" ? "🇺🇸 EN" : "🌐";
  const title =
    lang === "es" ? "Switch to English" : "Cambiar a Español";

  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      onClick={() => setLang(next)}
      style={btn}
    >
      <span style={txt}>{label}</span>
    </button>
  );
}

const btn = {
  position: "fixed",
  right: 16,
  bottom: 16,           // si te tapa algo, cambia a: top: 16, y elimina bottom
  width: 52,
  height: 52,
  borderRadius: 26,
  border: "1px solid #aaa",
  background: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 6px 18px rgba(0,0,0,0.2)",
  zIndex: 3000,
  // por si hay estilos globales agresivos:
  appearance: "none",
  WebkitAppearance: "none",
};

const txt = {
  fontWeight: 800,
  fontSize: 13,
  lineHeight: 1,
  color: "#111",        // fuerza texto oscuro
};
