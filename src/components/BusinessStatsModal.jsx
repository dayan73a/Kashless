import { useMemo, useState } from "react";
import { useI18n } from "../context/I18nContext.jsx";

const fmtUSD = (locale, cents) =>
  new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(
    Number(cents || 0) / 100
  );

/**
 * Calcula métricas a partir de transacciones normalizadas:
 *  item: { ts: Date, type: 'payment'|'recarga'|..., signed_cents, machine }
 *  business: objeto del negocio (para comisión fija o %)
 */
function useStats(transactions, business, range) {
  return useMemo(() => {
    if (!Array.isArray(transactions)) return null;

    // Rango
    const now = new Date();
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(startOfToday); startOfMonth.setDate(1);

    const from =
      range === "today" ? startOfToday :
      range === "week"  ? startOfWeek  :
      startOfMonth; // "month"

    // Comisión por defecto: 25¢ por operación
    const fixedCents =
      (typeof business?.comision_fija_cents === "number" && business.comision_fija_cents) ||
      (typeof business?.comision_fija === "number" && Math.round(business.comision_fija * 100)) ||
      25;

    const pct =
      (typeof business?.commission_pct === "number" && business.commission_pct) ||
      (typeof business?.comision_pct === "number" && business.comision_pct) ||
      (typeof business?.["commission.pct"] === "number" && business["commission.pct"]) ||
      (typeof business?.["comision.pct"] === "number" && business["comision.pct"]) ||
      null;

    let count = 0;
    let grossCents = 0;
    const byMachine = new Map();

    for (const t of transactions) {
      if (t?.type !== "payment") continue;
      const ts = t?.ts instanceof Date ? t.ts : null;
      if (!ts || ts < from) continue;

      const cents = Math.abs(Number(t?.signed_cents || 0));
      grossCents += cents;
      count += 1;

      const key = t?.machine || "-";
      const row = byMachine.get(key) || { count: 0, grossCents: 0 };
      row.count += 1;
      row.grossCents += cents;
      byMachine.set(key, row);
    }

    const feeCents = count > 0
      ? (fixedCents != null ? fixedCents * count : Math.round(grossCents * (pct || 0)))
      : 0;

    const netCents = Math.max(0, grossCents - feeCents);
    const avgCents = count ? Math.round(grossCents / count) : 0;

    const topMachines = Array.from(byMachine.entries())
      .map(([machine, v]) => ({ machine, ...v }))
      .sort((a, b) => b.grossCents - a.grossCents)
      .slice(0, 10);

    return { from, count, grossCents, feeCents, netCents, avgCents, topMachines };
  }, [transactions, business, range]);
}

export default function BusinessStatsModal({ open, onClose, transactions, business }) {
  const [range, setRange] = useState("week"); // today | week | month
  const { t, lang } = useI18n();
  const locale = lang === "es" ? "es-ES" : "en-US";
  const stats = useStats(transactions, business, range);

  if (!open) return null;

  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <h3 style={{ margin: 0 }}>{t("stats.title")}</h3>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        <div style={s.filters}>
          <button
            style={range === "today" ? s.filterBtnActive : s.filterBtn}
            onClick={() => setRange("today")}
          >
            {t("date.today")}
          </button>
          <button
            style={range === "week" ? s.filterBtnActive : s.filterBtn}
            onClick={() => setRange("week")}
          >
            {t("date.week")}
          </button>
          <button
            style={range === "month" ? s.filterBtnActive : s.filterBtn}
            onClick={() => setRange("month")}
          >
            {t("date.month")}
          </button>
        </div>

        {!stats ? (
          <div style={{ color: "#666" }}>{t("common.loading")}</div>
        ) : (
          <>
            <div style={s.kpiGrid}>
              <div style={s.kpiCard}>
                <div style={s.kpiLabel}>{t("stats.gross")}</div>
                <div style={s.kpiValue}>{fmtUSD(locale, stats.grossCents)}</div>
              </div>
              <div style={s.kpiCard}>
                <div style={s.kpiLabel}>{t("stats.fees")}</div>
                <div style={s.kpiValue}>{fmtUSD(locale, stats.feeCents)}</div>
              </div>
              <div style={s.kpiCard}>
                <div style={s.kpiLabel}>{t("stats.net")}</div>
                <div style={s.kpiValue}>{fmtUSD(locale, stats.netCents)}</div>
              </div>
              <div style={s.kpiCard}>
                <div style={s.kpiLabel}>{t("stats.paymentsCount")}</div>
                <div style={s.kpiValue}>{stats.count}</div>
              </div>
              <div style={s.kpiCard}>
                <div style={s.kpiLabel}>{t("stats.avgTicket")}</div>
                <div style={s.kpiValue}>{fmtUSD(locale, stats.avgCents)}</div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <h4 style={{ margin: "10px 0" }}>{t("stats.topMachines")}</h4>
              {stats.topMachines.length === 0 ? (
                <div style={{ color: "#777" }}>{t("stats.noData")}</div>
              ) : (
                <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid #eee", borderRadius: 8 }}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>{t("table.machine")}</th>
                        <th style={s.th}>{t("table.payments")}</th>
                        <th style={s.th}>{t("table.sales")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topMachines.map((m) => (
                        <tr key={m.machine}>
                          <td style={s.td}>{m.machine}</td>
                          <td style={s.tdCenter}>{m.count}</td>
                          <td style={s.tdRight}>{fmtUSD(locale, m.grossCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const s = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 1000
  },
  modal: {
    background: "#fff",
    borderRadius: 12,
    width: "min(900px, 96vw)",
    padding: 16,
    boxShadow: "0 10px 25px rgba(0,0,0,0.25)"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10
  },
  closeBtn: {
    border: "none",
    background: "#eee",
    borderRadius: 8,
    padding: "6px 10px",
    cursor: "pointer"
  },
  filters: { display: "flex", gap: 8, marginBottom: 10 },
  filterBtn: {
    padding: "8px 12px",
    border: "1px solid #ddd",
    borderRadius: 8,
    background: "#fff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 600
  },
  filterBtnActive: {
    padding: "8px 12px",
    border: "1px solid #0ea5e9",
    borderRadius: 8,
    background: "#e0f2fe",
    color: "#0369a1",
    cursor: "pointer",
    fontWeight: 700
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
    gap: 10,
    marginTop: 6
  },
  kpiCard: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 12
  },
  kpiLabel: { fontSize: 12, color: "#64748b" },
  kpiValue: { fontWeight: "bold", fontSize: 20, color: "#111827" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #eee", background: "#fafafa", color: "#111827" },
  td: { padding: "8px 10px", borderBottom: "1px solid #f1f1f1" },
  tdCenter: { padding: "8px 10px", textAlign: "center", borderBottom: "1px solid #f1f1f1" },
  tdRight: { padding: "8px 10px", textAlign: "right", borderBottom: "1px solid #f1f1f1" }
};
