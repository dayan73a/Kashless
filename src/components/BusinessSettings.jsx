// src/components/BusinessSettings.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  deleteField,
} from "firebase/firestore";

/** ---- Utilidades ---- */
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const moneyToCents = (usd) => Math.round(Number(usd || 0) * 100);
const centsToMoney = (c) => (Number(c || 0) / 100);

export default function BusinessSettings() {
  const navigate = useNavigate();
  // ✅ tomar loading del contexto con alias
  const { currentUser, loading: userLoading } = useApp();
  const { t, lang } = useI18n();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Modelo en memoria
  const [feeType, setFeeType] = useState("fixed"); // "fixed" | "percent"
  const [fixedUsd, setFixedUsd] = useState("0.25"); // texto controlado
  const [percent, setPercent] = useState("3"); // texto controlado (%)
  const [bizName, setBizName] = useState("");

  // Derivar businessId del usuario
  const bizId =
    currentUser?.negocio_id ||
    currentUser?.business_id ||
    currentUser?.businessId ||
    null;

  // Labels por idioma (fallback si faltan claves)
  const L = useMemo(() => {
    return {
      title: t("settings.title") || "Ajustes del negocio",
      feeType: t("settings.feeType") || "Tipo de comisión",
      fixed: t("settings.fixed") || "Fija por operación",
      percentLabel: t("settings.percent") || "Porcentaje",
      fixedUsd: t("settings.fixedUsd") || "Comisión fija (USD)",
      percentValue: t("settings.percentValue") || "Comisión (%)",
      explainer:
        t("settings.explainer") ||
        "Si hay comisión fija, se usa en lugar del porcentaje.",
      save: t("settings.save") || "Guardar",
      saved: t("settings.saved") || "Ajustes guardados",
      invalid: t("settings.invalid") || "Valores inválidos",
      back: t("common.back") || "Volver",
      name: t("biz.name") || "Nombre del negocio",
    };
  }, [t]);

  // Carga inicial
  useEffect(() => {
    (async () => {
      try {
        if (!currentUser || !bizId) return;
        setLoading(true);
        const ref = doc(db, "businesses", bizId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data();
          setBizName(d?.nombre || d?.name || "");
          // Precedencia: fija -> porcentaje
          if (typeof d?.comision_fija_cents === "number") {
            setFeeType("fixed");
            setFixedUsd(String(centsToMoney(d.comision_fija_cents)));
          } else if (typeof d?.comision_fija === "number") {
            setFeeType("fixed");
            setFixedUsd(String(d.comision_fija));
          } else if (typeof d?.commission_pct === "number") {
            setFeeType("percent");
            setPercent(String(d.commission_pct * 100));
          } else if (typeof d?.comision_pct === "number") {
            setFeeType("percent");
            setPercent(String(d.comision_pct * 100));
          } else {
            // defaults
            setFeeType("percent");
            setPercent("3");
          }
        } else {
          // defaults en negocio nuevo
          setFeeType("percent");
          setPercent("3");
        }
      } catch (e) {
        console.error("[BusinessSettings] load error:", e);
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser, bizId]);

  // Validación sencilla
  const valid = useMemo(() => {
    if (feeType === "fixed") {
      const v = Number(fixedUsd);
      if (Number.isNaN(v)) return false;
      return v >= 0 && v <= 10;
    } else {
      const v = Number(percent);
      if (Number.isNaN(v)) return false;
      return v >= 0 && v <= 20;
    }
  }, [feeType, fixedUsd, percent]);

  async function handleSave() {
    if (!valid || !bizId) return;
    setSaving(true);
    setError("");
    try {
      const ref = doc(db, "businesses", bizId);

      if (feeType === "fixed") {
        const v = clamp(Number(fixedUsd || 0), 0, 10);
        const cents = moneyToCents(v);
        // Guardamos la fija y limpiamos % para evitar conflictos
        await setDoc(
          ref,
          {
            nombre: bizName || deleteField(),
            comision_fija_cents: cents,
            comision_fija: v, // opcional, compat
            commission_pct: deleteField(),
            comision_pct: deleteField(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        const v = clamp(Number(percent || 0), 0, 20);
        const pct = v / 100;
        // Guardamos el % y limpiamos fija
        await setDoc(
          ref,
          {
            nombre: bizName || deleteField(),
            commission_pct: pct,
            comision_pct: pct, // alias compat
            comision_fija_cents: deleteField(),
            comision_fija: deleteField(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      alert(L.saved);
      navigate("/business-dashboard");
    } catch (e) {
      console.error("[BusinessSettings] save error:", e);
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  if (userLoading || loading) {
    return (
      <div style={s.container}>
        <div style={s.loading}>{t("common.loadingUser") || "Cargando..."}</div>
      </div>
    );
  }

  if (!currentUser?.es_dueno) {
    // Solo dueños
    navigate("/dashboard");
    return null;
  }

  return (
    <div style={s.container} key={lang}>
      <div style={s.header}>
        <button onClick={() => navigate("/business-dashboard")} style={s.back}>
          {L.back}
        </button>
        <h2 style={s.title}>{L.title}</h2>
      </div>

      <div style={s.card}>
        <label style={s.label}>{L.name}</label>
        <input
          type="text"
          value={bizName}
          onChange={(e) => setBizName(e.target.value)}
          placeholder="Mi negocio"
          style={s.input}
        />
      </div>

      <div style={s.card}>
        <label style={s.label}>{L.feeType}</label>
        <div style={s.row}>
          <label style={s.radio}>
            <input
              type="radio"
              name="feeType"
              value="fixed"
              checked={feeType === "fixed"}
              onChange={() => setFeeType("fixed")}
            />
            <span>{L.fixed}</span>
          </label>
          <label style={s.radio}>
            <input
              type="radio"
              name="feeType"
              value="percent"
              checked={feeType === "percent"}
              onChange={() => setFeeType("percent")}
            />
            <span>{L.percentLabel}</span>
          </label>
        </div>

        {feeType === "fixed" ? (
          <div style={{ marginTop: 12 }}>
            <label style={s.label}>{L.fixedUsd}</label>
            <input
              type="number"
              min={0}
              max={10}
              step="0.01"
              value={fixedUsd}
              onChange={(e) => setFixedUsd(e.target.value)}
              style={s.input}
            />
            <small style={s.help}>
              {L.explainer} — 0.00–10.00 USD
            </small>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <label style={s.label}>{L.percentValue}</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number"
                min={0}
                max={20}
                step="0.1"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                style={s.input}
              />
              <span>%</span>
            </div>
            <small style={s.help}>
              {L.explainer} — 0–20%
            </small>
          </div>
        )}
      </div>

      {error && (
        <div style={s.error}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={s.actions}>
        <button
          onClick={handleSave}
          disabled={!valid || saving}
          style={(!valid || saving) ? { ...s.primary, ...s.disabled } : s.primary}
          title={!valid ? L.invalid : ""}
        >
          {saving ? "…" : L.save}
        </button>
      </div>
    </div>
  );
}

/** ---- Estilos simples ---- */
const s = {
  container: {
    padding: 20,
    minHeight: "100vh",
    background: "#f5f5f5",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  back: {
    padding: "8px 12px",
    background: "#95a5a6",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
  title: { margin: 0, color: "#2c3e50" },

  card: {
    background: "#fff",
    padding: 16,
    borderRadius: 10,
    boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
    marginBottom: 12,
  },
  label: { display: "block", marginBottom: 6, color: "#34495e", fontWeight: 600 },
  row: { display: "flex", gap: 16, alignItems: "center" },
  radio: { display: "flex", gap: 8, alignItems: "center" },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #dfe6e9",
    outline: "none",
  },
  help: { display: "block", marginTop: 6, color: "#7f8c8d" },

  error: {
    color: "#991b1b",
    background: "#fee2e2",
    border: "1px solid #fecaca",
    padding: 12,
    borderRadius: 12,
    margin: "6px 0 0",
    fontWeight: 700,
  },

  actions: { display: "flex", justifyContent: "flex-end", marginTop: 8, gap: 8 },
  primary: {
    padding: "10px 16px",
    background: "#2ecc71",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    minWidth: 140,
  },
  disabled: { opacity: 0.6, cursor: "not-allowed" },
};
