// src/components/BusinessDashboard.jsx
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import {
  collection,
  collectionGroup,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  limit,
} from "firebase/firestore";
import { db } from "../firebase";
import BusinessStatsModal from "./BusinessStatsModal.jsx";
import { useI18n } from "../context/I18nContext.jsx";

/** ---- Helpers de formato ---- */
function useFormatters(lang) {
  const locale = lang === "es" ? "es-ES" : "en-US";
  const fMoney = (cents) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(
      Number(cents || 0) / 100
    );
  const fDateTime = (d) =>
    d
      ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(d)
      : "";
  return { fMoney, fDateTime };
}

export default function BusinessDashboard() {
  const navigate = useNavigate();
  const { currentUser, loading: userLoading } = useApp();
  const { t, lang } = useI18n();
  const { fMoney, fDateTime } = useFormatters(lang);

  // filtros de rango / mes
  const [range, setRange] = useState("today"); // "today" | "week" | "month"
  const [selectedMonth, setSelectedMonth] = useState("");
  const [monthOptions, setMonthOptions] = useState([]);

  // datos
  const [loading, setLoading] = useState(true);
  const [businessData, setBusinessData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [financialSummary, setFinancialSummary] = useState({
    ventasHoy: 0,
    ventasSemana: 0,
    comisionesAcumuladas: 0,
    saldoDisponible: 0,
  });
  const [showStats, setShowStats] = useState(false);

  // businessId posible en varios campos
  const bizId =
    currentUser?.negocio_id ||
    currentUser?.business_id ||
    currentUser?.businessId ||
    null;

  /** ---- Opciones de meses (últimos 12) ---- */
  useEffect(() => {
    const now = new Date();
    const opts = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString(lang === "es" ? "es-ES" : "en-US", {
        month: "long",
        year: "numeric",
      });
      opts.push({ key, label });
    }
    setMonthOptions(opts);
    if (!selectedMonth && opts.length) setSelectedMonth(opts[0].key);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  /** ---- Carga de negocio + transacciones (raíz + collectionGroup si hay índices) ---- */
  useEffect(() => {
    if (!currentUser || !bizId) return;

    setLoading(true);
    const unsubs = [];
    let lastMergedCache = [];

    (async () => {
      try {
        // 1) negocio
        const bizRef = doc(db, "businesses", bizId);
        const bizSnap = await getDoc(bizRef);
        const biz = bizSnap.exists() ? bizSnap.data() : null;
        setBusinessData(biz || null);

        const ownerId = biz?.dueño_id || biz?.owner_id || currentUser.uid;

        // % por defecto si no hay fija/%
        const commissionPctDefault = 0.03;

        // 2) transacciones posibles
        const txRoot = collection(db, "transactions");
        const txCG = collectionGroup(db, "transactions");

        const rootQueries = [
          query(txRoot, where("business_id", "==", bizId), limit(50)),
          query(txRoot, where("negocio_id", "==", bizId), limit(50)),
          query(txRoot, where("userId", "==", ownerId), limit(50)),
          query(txRoot, where("user_id", "==", ownerId), limit(50)),
        ];

        const groupQueries = [
          query(txCG, where("business_id", "==", bizId), limit(50)),
          query(txCG, where("negocio_id", "==", bizId), limit(50)),
          query(txCG, where("userId", "==", ownerId), limit(50)),
          query(txCG, where("user_id", "==", ownerId), limit(50)),
        ];

        const buckets = [[], [], [], [], [], [], [], []];

        const normalize = (d) => {
          const raw = d.data();
          const ts =
            (raw.created_at && raw.created_at.toDate && raw.created_at.toDate()) ||
            (raw.fecha && raw.fecha.toDate && raw.fecha.toDate()) ||
            (raw.startTime && raw.startTime.toDate && raw.startTime.toDate()) ||
            null;

          const type =
            raw.type ||
            raw.tipo ||
            (raw.paidWithWalletCents ? "payment" : "unknown");

          const amount =
            raw.amount_cents ??
            raw.amountCents ??
            raw.paidWithWalletCents ??
            (typeof raw.monto === "number" ? Math.round(raw.monto * 100) : 0);

          const sign = raw.sign || (type === "payment" ? "-" : "+");
          const signed = (sign === "-" ? -1 : 1) * Math.abs(Number(amount || 0));

          return {
            id: d.id,
            ts,
            type,
            signed_cents: signed,
            machine: raw.machine_id || raw.machineId || "-",
            user: raw.user_id || raw.userId || "-",
          };
        };

        const recompute = () => {
          const haveAny = buckets.some((b) => b.length > 0);
          if (!haveAny && lastMergedCache.length > 0) {
            setLoading(false);
            return;
          }

          const map = new Map();
          buckets.flat().forEach((docSnap) => {
            map.set(docSnap.ref.path, { id: docSnap.id, ...docSnap.data(), __path: docSnap.ref.path });
          });

          const merged = Array.from(map.values())
            .map((raw) => normalize({ id: raw.id, data: () => raw }))
            .sort((a, b) => (b.ts?.getTime?.() || 0) - (a.ts?.getTime?.() || 0));

          lastMergedCache = merged.slice();
          setTransactions(merged);

          // KPIs
          const now = new Date();
          const todayStr = now.toDateString();
          const startOfWeek = new Date(now);
          startOfWeek.setHours(0, 0, 0, 0);
          startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // domingo

          let ventasHoy = 0;
          let ventasSemana = 0;
          let countSemana = 0;

          for (const tx of merged) {
            if (tx.type !== "payment") continue;
            const cents = Math.abs(tx.signed_cents);
            if (tx.ts?.toDateString?.() === todayStr) ventasHoy += cents;
            if (tx.ts && tx.ts >= startOfWeek) {
              ventasSemana += cents;
              countSemana += 1;
            }
          }

          const comisionFijaCents =
            (typeof biz?.comision_fija_cents === "number" && biz.comision_fija_cents) ||
            (typeof biz?.comision_fija === "number" && Math.round(biz.comision_fija * 100)) ||
            null;

          const pct =
            (typeof biz?.commission_pct === "number" && biz.commission_pct) ||
            (typeof biz?.comision_pct === "number" && biz.comision_pct) ||
            commissionPctDefault;

          const comisionesAcumuladasCents =
            countSemana > 0
              ? comisionFijaCents != null
                ? countSemana * comisionFijaCents
                : Math.round(ventasSemana * pct)
              : 0;

          const saldoDisponibleCents = Math.max(0, ventasSemana - comisionesAcumuladasCents);

          setFinancialSummary({
            ventasHoy,
            ventasSemana,
            comisionesAcumuladas: comisionesAcumuladasCents,
            saldoDisponible: saldoDisponibleCents,
          });

          setLoading(false);
        };

        // listeners raíz
        rootQueries.forEach((qObj, i) => {
          unsubs.push(
            onSnapshot(
              qObj,
              (snap) => {
                buckets[i] = snap.docs;
                recompute();
              },
              () => {}
            )
          );
        });

        // listeners collectionGroup (si faltan índices, ignorar error)
        groupQueries.forEach((qObj, idx) => {
          const i = 4 + idx;
          unsubs.push(
            onSnapshot(
              qObj,
              (snap) => {
                buckets[i] = snap.docs;
                recompute();
              },
              (err) => {
                const msg = err?.message || "";
                if (msg.includes("requires an index")) return;
              }
            )
          );
        });
      } catch (e) {
        console.error("[BusinessDashboard] load error:", e);
        setLoading(false);
      }
    })();

    return () => unsubs.forEach((u) => u && u());
  }, [currentUser, bizId]); // no dependemos de t/lang para evitar re-suscripciones

  /** ---- Filtro para export según rango/mes ---- */
  const filteredForExport = useMemo(() => {
    if (!Array.isArray(transactions)) return [];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfToday.getDay()); // domingo

    if (range === "today") {
      return transactions.filter((tx) => tx.ts && tx.ts >= startOfToday);
    }
    if (range === "week") {
      return transactions.filter((tx) => tx.ts && tx.ts >= startOfWeek);
    }
    if (range === "month" && selectedMonth) {
      const [y, m] = selectedMonth.split("-").map((n) => parseInt(n, 10));
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 1);
      return transactions.filter((tx) => tx.ts && tx.ts >= start && tx.ts < end);
    }
    return transactions;
  }, [transactions, range, selectedMonth]);

  /** ---- Exportar CSV ---- */
  function handleExportCsv() {
    const rows = [
      ["id", "fecha", "tipo", "monto_cents", "maquina", "usuario"],
      ...filteredForExport.map((tx) => [
        tx.id || "",
        tx.ts ? tx.ts.toISOString() : "",
        tx.type || "",
        tx.signed_cents ?? "",
        tx.machine || "",
        tx.user || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const label =
      range === "month" && selectedMonth ? `_${selectedMonth}` :
      range === "week" ? "_week" :
      "_today";
    a.download = `kashless_transactions${label}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** ---- Guardas de navegación / estados ---- */
  if (userLoading || !currentUser) {
    return (
      <div style={s.container}>
        <div style={s.loading}>{t("common.loadingUser") || "Cargando..."}</div>
      </div>
    );
  }

  if (!currentUser.es_dueno) {
    navigate("/dashboard");
    return null;
  }

  /** ---- UI ---- */
  return (
    <div style={s.container} key={lang}>
      <div style={s.header}>
        <button onClick={() => navigate("/dashboard")} style={s.backButton}>
          {t("common.back")}
        </button>
        <h2 style={s.title}>
          {t("biz.title")}
          {businessData?.nombre ? ` - ${businessData.nombre}` : ""}
        </h2>
      </div>

      {/* Controles: rango + mes + export + ajustes */}
      <div style={s.controlsRow}>
        <div style={s.rangeGroup}>
          <button
            onClick={() => setRange("today")}
            style={range === "today" ? s.rangeButtonActive : s.rangeButton}
          >
            {t("stats.today") || "Hoy"}
          </button>
          <button
            onClick={() => setRange("week")}
            style={range === "week" ? s.rangeButtonActive : s.rangeButton}
          >
            {t("stats.week") || "Semana"}
          </button>
          <button
            onClick={() => setRange("month")}
            style={range === "month" ? s.rangeButtonActive : s.rangeButton}
          >
            {t("stats.month") || "Mes"}
          </button>

          {range === "month" && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #dfe6e9" }}
            >
              {monthOptions.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          )}
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            style={s.exportButton}
            onClick={handleExportCsv}
            disabled={filteredForExport.length === 0}
            title={filteredForExport.length === 0 ? (t("biz.noTx") || "Sin datos para exportar") : ""}
          >
            {t("biz.exportReport") || "Exportar CSV"}
          </button>

          <button
            style={s.secondaryButton}
            onClick={() => navigate("/business-settings")}
          >
            {t("biz.settings") || "Ajustes"}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={s.summaryGrid}>
        <div style={s.summaryCard}>
          <h3>{t("biz.salesToday")}</h3>
          <p style={s.amount}>{fMoney(financialSummary.ventasHoy)}</p>
        </div>
        <div style={s.summaryCard}>
          <h3>{t("biz.salesWeek")}</h3>
          <p style={s.amount}>{fMoney(financialSummary.ventasSemana)}</p>
        </div>
        <div style={s.summaryCard}>
          <h3>{t("biz.fees")}</h3>
          <p style={s.amount}>{fMoney(financialSummary.comisionesAcumuladas)}</p>
        </div>
        <div style={s.summaryCard}>
          <h3>{t("biz.availableBalance")}</h3>
          <p style={s.amount}>{fMoney(financialSummary.saldoDisponible)}</p>
        </div>
      </div>

      {/* Últimas transacciones */}
      <div style={s.section}>
        <h3>
          {t("biz.latestTx")} ({transactions.length})
        </h3>
        {transactions.length === 0 ? (
          <p style={s.empty}>{t("biz.noTx")}</p>
        ) : (
          <div style={s.transactionsList}>
            {transactions.slice(0, 10).map((tx) => (
              <div key={tx.id + "_" + (tx.ts?.getTime?.() || "")} style={s.transactionCard}>
                <div style={s.transactionHeader}>
                  <span>{fDateTime(tx.ts)}</span>
                  <span style={s.amountSmall}>
                    {tx.signed_cents < 0 ? "-" : "+"}
                    {fMoney(Math.abs(tx.signed_cents))}
                  </span>
                </div>
                <div>{t("tx.type")}: {tx.type}</div>
                <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t("tx.machine")}: {tx.machine}
                </div>
                <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t("tx.user")}: {tx.user}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Botón para abrir modal de estadísticas */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
        <button style={s.primaryButton} onClick={() => setShowStats(true)}>
          {t("biz.viewFullStats")}
        </button>
      </div>

      {/* Modal de estadísticas (montaje seguro) */}
      {showStats && (
        <BusinessStatsModal
          open={showStats}
          onClose={() => setShowStats(false)}
          transactions={transactions}
          business={businessData}
        />
      )}
    </div>
  );
}

/** ---- Estilos ---- */
const s = {
  container: {
    padding: "20px",
    minHeight: "100vh",
    backgroundColor: "#f5f5f5",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "15px",
    marginBottom: "20px",
  },
  backButton: {
    padding: "10px 15px",
    background: "#95a5a6",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
  title: { margin: 0, color: "#2c3e50" },

  controlsRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  rangeGroup: { display: "flex", gap: 8, alignItems: "center" },
  rangeButton: {
    padding: "8px 12px",
    background: "#ecf0f1",
    color: "#2c3e50",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },
  rangeButtonActive: {
    padding: "8px 12px",
    background: "#3498db",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },
  exportButton: {
    padding: "10px 16px",
    background: "#8e44ad",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    background: "#fff",
    padding: 16,
    textAlign: "center",
    borderRadius: 10,
    boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
  },
  amount: { fontSize: 22, fontWeight: "bold", color: "#27ae60", margin: 0 },
  amountSmall: { fontWeight: "bold", color: "#27ae60" },

  section: {
    background: "#fff",
    padding: 16,
    borderRadius: 10,
    boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
  },
  empty: { color: "#7f8c8d", fontStyle: "italic" },
  transactionsList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    maxHeight: 384,
    overflowY: "auto",
  },
  transactionCard: { padding: 12, border: "1px solid #eee", borderRadius: 8, background: "#fafafa" },
  transactionHeader: { display: "flex", justifyContent: "space-between", marginBottom: 4 },

  primaryButton: {
    padding: "12px 20px",
    background: "#3498db",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "10px 16px",
    background: "#2ecc71",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },
};
