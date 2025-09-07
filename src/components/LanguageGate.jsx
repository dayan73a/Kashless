// src/components/LanguageGate.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../context/I18nContext.jsx";

export default function LanguageGate() {
  const { setLang, t } = useI18n();
  const navigate = useNavigate();

  function pick(code) {
    setLang(code);
    // te manda a home; si estás logueado, irás a /dashboard por tu App.jsx
    navigate("/", { replace: true });
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h2 style={{ marginTop: 0 }}>{t("language.choose")}</h2>
        <div style={styles.row}>
          <button style={styles.btn} onClick={() => pick("es")}>🇪🇸 {t("language.es")}</button>
          <button style={styles.btn} onClick={() => pick("en")}>🇺🇸 {t("language.en")}</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", padding: 16 },
  card: { background: "#fff", padding: 20, borderRadius: 12, boxShadow: "0 6px 20px rgba(0,0,0,0.1)", width: "100%", maxWidth: 420, textAlign: "center" },
  row: { display: "flex", gap: 12, justifyContent: "center", marginTop: 12 },
  btn: { padding: "12px 16px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontWeight: 700, minWidth: 160 },
};
