// src/components/TransactionHistory.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../context/I18nContext.jsx";
import { useApp } from "../context/AppContext.jsx";
import {
  collection,
  collectionGroup,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

/* ----------------------- Fechas / Mes ----------------------- */
function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function startOfMonth(d = new Date()) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}
function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function buildLast12MonthsOptions(now = new Date()) {
  const opts = [];
  const base = new Date(now);
  base.setDate(1);
  for (let i = 0; i < 12; i++) {
    const d = new Date(base);
    d.setMonth(base.getMonth() - i);
    const key = monthKey(d);
    const label = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    opts.push({ key, label, start: new Date(d), end: new Date(d.getFullYear(), d.getMonth() + 1, 1) });
  }
  return opts;
}

/* ----------------------- CSV helpers ----------------------- */
function toCsvValue(v) {
  if (v == null) return "";
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}
function downloadCsv(filename, rows) {
  const BOM = "\uFEFF";
  const csv = rows.map((r) => r.map(toCsvValue).join(",")).join("\n");
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ----------------------- UI ----------------------- */
const s = {
  container: { padding: 20, minHeight: "100vh", background: "#f5f5f5" },
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 12 },
  back: {
    padding: "8px 12px",
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
    gap: 12,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  rangeGroup: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" },
  rangeButton: {
    padding: "8px 12px",
    background: "#ecf0f1",
    color: "#2c3e50",
    border: "1px solid #dfe6e9",
    borderRadius: 8,
    cursor: "pointer",
  },
  rangeButtonActive: {
    padding: "8px 12px",
    background: "#2ecc71",
    color: "#fff",
    border: "1px solid #27ae60",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: "bold",
  },
  exportButton: {
    padding: "10px 16px",
    background: "#2ecc71",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    minWidth: 160,
  },
  list: {
    background: "#fff",
    padding: 16,
    borderRadius: 10,
    boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
  },
  item: {
    padding: 12,
    border: "1px solid #eee",
    borderRadius: 8,
    background: "#fafafa",
  },
  row: { display: "flex", justifyContent: "space-between", marginBottom: 4 },
  amountPos: { color: "#27ae60", fontWeight: "bold" },
  amountNeg: { color: "#c0392b", fontWeight: "bold" },
  empty: { color: "#7f8c8d", fontStyle: "italic" },
  kpis: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: 12,
    marginBottom: 12,
  },
  card: {
    background: "#fff",
    padding: 14,
    borderRadius: 10,
    textAlign: "center",
    boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
  },
};

/* ----------------------- Component ----------------------- */
export default function TransactionHistory() {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const { currentUser, userLoading } = useApp();

  const locale = lang === "es" ? "es-ES" : "en-US";
  const fMoney = (cents) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(
      Number(cents || 0) / 100
    );
  const fDateTime = (d) =>
    d
      ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(d)
      : "";

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);

  // Rango + selector mes
  const [range, setRange] = useState("month"); // "today" | "week" | "month"
  const [selectedMonth, setSelectedMonth] = useState(monthKey());
  const monthOptions = useMemo(() => buildLast12MonthsOptions(new Date()), []);

  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!currentUser?.uid) return;
    setLoading(true);
    const unsubs = [];
    const uid = currentUser.uid;

    const txRoot = collection(db, "transactions");
    const txCG = collectionGroup(db, "transactions");

    const rootQueries = [
      query(txRoot, where("userId", "==", uid), limit(100)),
      query(txRoot, where("user_id", "==", uid), limit(100)),
      query(txRoot, where("usuario", "==", uid), limit(100)),
    ];
    const groupQueries = [
      query(txCG, where("userId", "==", uid), limit(100)),
      query(txCG, where("user_id", "==", uid), limit(100)),
      query(txCG, where("usuario", "==", uid), limit(100)),
    ];

    const buckets = [[], [], [], [], [], []];

    const normalize = (raw) => {
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
        id: raw.id,
        ts,
        type,
        signed_cents: signed,
        machine: raw.machine_id || raw.machineId || "-",
        business: raw.business_id || raw.negocio_id || "-",
      };
    };

    const recompute = () => {
      const map = new Map();
      buckets.flat().forEach((d) => {
        map.set(d.ref.path, { id: d.id, ...d.data(), __path: d.ref.path });
      });
      const merged = Array.from(map.values())
        .map(normalize)
        .sort((a, b) => (b.ts?.getTime?.() || 0) - (a.ts?.getTime?.() || 0));
      setTransactions(merged);
      setLoading(false);
    };

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

    groupQueries.forEach((qObj, idx) => {
      const i = 3 + idx;
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

    return () => unsubs.forEach((u) => u && u());
  }, [currentUser?.uid]);

  // Filtrado por rango + mes
  const filtered = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    const now = new Date();
    let from, to;
    if (range === "today") {
      from = new Date(now); from.setHours(0,0,0,0);
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else if (range === "week") {
      from = new Date(now); from.setHours(0,0,0,0); from.setDate(from.getDate() - from.getDay());
      to = new Date(from); to.setDate(from.getDate() + 7);
    } else {
      const opt = monthOptions.find((o) => o.key === selectedMonth);
      if (opt) { from = opt.start; to = opt.end; }
      else { from = startOfMonth(now); to = new Date(now.getFullYear(), now.getMonth()+1, 1); }
    }
    return transactions.filter((tx) => tx.ts && tx.ts >= from && tx.ts < to);
  }, [transactions, range, selectedMonth, monthOptions]);

  const totals = useMemo(() => {
    let spent = 0;
    let added = 0;
    for (const tx of filtered) {
      if (tx.signed_cents < 0) spent += Math.abs(tx.signed_cents);
      else added += tx.signed_cents;
    }
    return { spent, added, count: filtered.length };
  }, [filtered]);

  const rowsForCsv = useMemo(() => {
    const header = [
      "tx_id",
      "timestamp",
      "type",
      "machine_id",
      "business_id",
      "amount_cents",
      "sign",
    ];
    const body = filtered.map((tx) => [
      tx.id || "",
      tx.ts ? tx.ts.toISOString() : "",
      tx.type || "",
      tx.machine || "",
      tx.business || "",
      Math.abs(Number(tx.signed_cents || 0)),
      tx.signed_cents < 0 ? "-" : "+",
    ]);
    return [header, ...body];
  }, [filtered]);

  async function handleExportCsv() {
    setExporting(true);
    try {
      const now = new Date();
      const y = String(now.getFullYear());
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const label = range === "today" ? "today" : range === "week" ? "week" : "month";
      const filename = `kashless_user_tx_${label}_${y}${m}${d}.csv`;
      downloadCsv(filename, rowsForCsv);
    } finally {
      setExporting(false);
    }
  }

  if (userLoading || !currentUser) {
    return (
      <div style={s.container}>
        <div>{t("common.loadingUser")}</div>
      </div>
    );
  }

  return (
    <div style={s.container} key={lang}>
      <div style={s.header}>
        <button onClick={() => navigate("/dashboard")} style={s.back}>
          {t("common.back")}
        </button>
        <h2 style={s.title}>{t("history.title") || "Historial"}</h2>
      </div>

      {/* KPIs */}
      <div style={s.kpis}>
        <div style={s.card}>
          <div>{t("history.count") || "Transacciones"}</div>
          <div style={{ fontWeight: "bold" }}>{totals.count}</div>
        </div>
        <div style={s.card}>
          <div>{t("history.spent") || "Gastado"}</div>
          <div style={{ fontWeight: "bold", color: "#c0392b" }}>{fMoney(totals.spent)}</div>
        </div>
        <div style={s.card}>
          <div>{t("history.added") || "Recargado"}</div>
          <div style={{ fontWeight: "bold", color: "#27ae60" }}>{fMoney(totals.added)}</div>
        </div>
      </div>

      {/* Controles: rango + mes + export */}
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

        <button
          style={s.exportButton}
          onClick={handleExportCsv}
          disabled={exporting || filtered.length === 0}
          title={filtered.length === 0 ? (t("history.noData") || "Sin datos") : ""}
        >
          {exporting ? (t("history.exporting") || "Exportando…") : (t("history.exportCsv") || "Exportar CSV")}
        </button>
      </div>

      {/* Lista */}
      <div style={s.list}>
        {loading ? (
          <div>{t("common.loading") || "Cargando..."}</div>
        ) : filtered.length === 0 ? (
          <div style={s.empty}>{t("history.empty") || "Sin transacciones"}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((tx) => (
              <div key={tx.id + "_" + (tx.ts?.getTime?.() || "")} style={s.item}>
                <div style={s.row}>
                  <span>{tx.ts ? fDateTime(tx.ts) : "-"}</span>
                  <span style={tx.signed_cents < 0 ? s.amountNeg : s.amountPos}>
                    {tx.signed_cents < 0 ? "-" : "+"}
                    {fMoney(Math.abs(tx.signed_cents))}
                  </span>
                </div>
                <div>{(t("tx.type") || "Tipo")}: {tx.type}</div>
                <div>{(t("tx.machine") || "Máquina")}: {tx.machine}</div>
                <div>{(t("tx.business") || "Negocio")}: {tx.business}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
