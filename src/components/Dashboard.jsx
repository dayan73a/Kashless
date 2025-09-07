// src/components/Dashboard.jsx
import { useState, useEffect, useRef } from "react";
import { signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
  collectionGroup,
  query,
  where,
  onSnapshot,
  limit,
} from "firebase/firestore";
import { auth, db, ensureSignedIn } from "../firebase";
import {
  ensureWalletDoc,
  creditWallet,
  getWalletBalance,
} from "../lib/wallet"; // ✅ wallet correcto
import { useNavigate } from "react-router-dom";
import { useI18n } from "../context/I18nContext.jsx";

// --- helpers ---
function fmtUSD(n) {
  const v = Number.isFinite(+n) ? +n : 0;
  return `$${v.toFixed(2)}`;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { t } = useI18n();

  // Estado principal: usamos balanceCents como fuente de la verdad
  const [balanceCents, setBalanceCents] = useState(null);
  const [userDoc, setUserDoc] = useState({});
  const [loading, setLoading] = useState(true);

  // Controles recarga
  const [customAmount, setCustomAmount] = useState(0);
  const [topupBusy, setTopupBusy] = useState(false);

  // === Estadísticas del usuario (modal) ===
  const [showUserStats, setShowUserStats] = useState(false);
  const [uStats, setUStats] = useState({
    todayCount: 0,
    weekCount: 0,
    monthCount: 0,
    todayCents: 0,
    weekCents: 0,
    monthCents: 0,
    avg30Cents: 0,
  });
  const userStatsUnsubsRef = useRef([]);

  // Carga inicial de datos (usuario + billetera)
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await ensureSignedIn();
        const uid = auth.currentUser?.uid;
        if (!uid) {
          navigate("/");
          return;
        }

        setLoading(true);

        // 1) Asegura doc users/{uid} con balanceCents
        await ensureWalletDoc(uid);

        // 2) Lee balance en centavos (entero)
        const cents = await getWalletBalance(uid);
        if (mounted) setBalanceCents(cents);

        // 3) Trae el doc de usuario (por si tienes flags como es_dueno)
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists() && mounted) {
          setUserDoc(snap.data());
        }
      } catch (e) {
        console.error("Error cargando datos:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  // Acción: recargar saldo (en USD)
  async function recargarSaldo(montoUSD) {
    try {
      setTopupBusy(true);
      await ensureSignedIn();
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("No autenticado.");

      // Garantiza doc y acredita en centavos
      await ensureWalletDoc(uid);
      const cents = Math.round(Number(montoUSD) * 100);

      const newBalanceCents = await creditWallet(uid, cents, {
        source: "dashboard_topup",
      });
      setBalanceCents(newBalanceCents);

      // Escribe transacción (nuevo esquema que lee el History nuevo)
      await addDoc(collection(db, "transactions"), {
        userId: uid,
        type: "recarga",
        amount: Number(montoUSD), // para UI
        amountCents: cents, // exacto
        currency: "USD",
        startTime: serverTimestamp(),
        detail: `Top-up ${fmtUSD(montoUSD)}`,
      });

      setCustomAmount(0);
      alert(`${t('recharge.title')} ${fmtUSD(montoUSD)} ✔`);
    } catch (e) {
      console.error("Error recargando saldo:", e);
      alert(e?.message || "Error al recargar saldo");
    } finally {
      setTopupBusy(false);
    }
  }

  // Cerrar sesión
  async function handleLogout() {
    try {
      await signOut(auth);
      navigate("/");
      alert(t('actions.logout'));
    } catch (e) {
      console.error("Error cerrando sesión:", e);
      alert("Error al cerrar sesión");
    }
  }

  // --- Modal de estadísticas: listeners cuando se abre ---
  useEffect(() => {
    // limpiar suscripciones previas
    const cleanup = () => {
      userStatsUnsubsRef.current.forEach((u) => u && u());
      userStatsUnsubsRef.current = [];
    };

    if (!showUserStats) {
      cleanup();
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) {
      cleanup();
      return;
    }

    // Fuentes: raíz (funciona sin índices) + group (si hay índices)
    const txRoot = collection(db, "transactions");
    const txCG = collectionGroup(db, "transactions");

    const queriesArr = [
      // raíz
      query(txRoot, where("userId", "==", uid), limit(200)),
      query(txRoot, where("user_id", "==", uid), limit(200)),
      // group (si falla por índice, lo ignoramos en callback)
      query(txCG, where("userId", "==", uid), limit(200)),
      query(txCG, where("user_id", "==", uid), limit(200)),
    ];

    const buckets = [[], [], [], []];

    const recompute = () => {
      // fusiona por path para no duplicar
      const map = new Map();
      buckets
        .flat()
        .forEach((d) =>
          map.set(d.ref.path, { id: d.id, ...d.data(), __path: d.ref.path })
        );

      const rows = Array.from(map.values()).map((r) => {
        const ts =
          (r.created_at?.toDate && r.created_at.toDate()) ||
          (r.fecha?.toDate && r.fecha.toDate()) ||
          (r.startTime?.toDate && r.startTime.toDate()) ||
          null;
        const type =
          r.type || r.tipo || (r.paidWithWalletCents ? "payment" : "unknown");
        const amountCents =
          r.amount_cents ??
          r.amountCents ??
          r.paidWithWalletCents ??
          (typeof r.monto === "number" ? Math.round(r.monto * 100) : 0);
        const signed =
          r.sign === "-" || type === "payment"
            ? -Math.abs(amountCents)
            : Math.abs(amountCents);
        return { ts, type, signed };
      });

      // ventanas de tiempo
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      const startOf30 = new Date(now);
      startOf30.setDate(startOf30.getDate() - 30);

      let tCents = 0,
        wCents = 0,
        mCents = 0,
        tN = 0,
        wN = 0,
        mN = 0,
        last30Cents = 0,
        last30N = 0;

      for (const r of rows) {
        if (r.type !== "payment") continue; // contamos compras (no recargas)
        const cents = Math.abs(r.signed);
        if (!r.ts) continue;

        if (r.ts >= startOfToday) {
          tCents += cents;
          tN += 1;
        }
        if (r.ts >= startOfWeek) {
          wCents += cents;
          wN += 1;
        }
        if (r.ts >= startOf30) {
          mCents += cents;
          mN += 1;
          last30Cents += cents;
          last30N += 1;
        }
      }

      setUStats({
        todayCount: tN,
        weekCount: wN,
        monthCount: mN,
        todayCents: tCents,
        weekCents: wCents,
        monthCents: mCents,
        avg30Cents: last30N ? Math.round(last30Cents / last30N) : 0,
      });
    };

    queriesArr.forEach((q, idx) => {
      const unsub = onSnapshot(
        q,
        (snap) => {
          buckets[idx] = snap.docs;
          recompute();
        },
        (err) => {
          const msg = err?.message || "";
          if (msg.includes("COLLECTION_GROUP_ASC")) {
            // índice de group no listo: no rompemos nada
            return;
          }
          console.warn("UserStats snapshot error", msg);
        }
      );
      userStatsUnsubsRef.current.push(unsub);
    });

    return cleanup;
  }, [showUserStats]);

  if (loading) {
    return <div style={styles.loading}>{t('recharge.processing')}</div>;
  }

  const shownUSD =
    balanceCents == null ? "$0.00" : fmtUSD(Number(balanceCents) / 100);

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>{t('dashboard.title')}</h2>

      <div style={styles.balanceCard}>
        <h3 style={styles.balanceTitle}>{t('balance.title')}</h3>
        <h1 style={styles.balanceAmount}>{shownUSD}</h1>
      </div>

      <div style={styles.saldoSection}>
        <h3>{t('recharge.title')}</h3>
        <div style={styles.recargaButtons}>
          <button onClick={() => recargarSaldo(10)} style={styles.recargaButton} disabled={topupBusy}>$10</button>
          <button onClick={() => recargarSaldo(20)} style={styles.recargaButton} disabled={topupBusy}>$20</button>
          <button onClick={() => recargarSaldo(50)} style={styles.recargaButton} disabled={topupBusy}>$50</button>
        </div>

        <div style={styles.customAmount}>
          <input
            type="number"
            placeholder={t('recharge.other')}
            style={styles.input}
            value={customAmount || ""}
            onChange={(e) => setCustomAmount(Number(e.target.value))}
          />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button
            onClick={() => customAmount > 0 && recargarSaldo(customAmount)}
            style={styles.customButton}
            disabled={customAmount <= 0 || topupBusy}
          >
            {topupBusy ? t('recharge.processing') : t('recharge.title')}
          </button>
        </div>
      </div>

      <div style={styles.buttonGroup}>
        <button style={styles.secondaryButton} onClick={() => navigate("/scanner")}>
          {t('actions.scan')}
        </button>
        <button style={styles.secondaryButton} onClick={() => navigate("/history")}>
          {t('actions.history')}
        </button>
        <button
          style={styles.secondaryButton}
          onClick={() => {
            if (userDoc?.es_dueno) {
              navigate("/business-dashboard");
            } else {
              setShowUserStats(true);
            }
          }}
        >
          {userDoc?.es_dueno ? t('actions.business') : t('actions.stats')}
        </button>
      </div>

      <button onClick={handleLogout} style={styles.logoutButton}>
        {t('actions.logout')}
      </button>

      {/* Modal de estadísticas del usuario */}
      {showUserStats && (
        <div style={styles.modalBackdrop} onClick={() => setShowUserStats(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>{t('stats.user.title')}</h3>
              <button onClick={() => setShowUserStats(false)} style={styles.closeBtn}>✕</button>
            </div>

            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statTitle}>{t('stats.payments.today')}</div>
                <div style={styles.statValue}>{uStats.todayCount}</div>
                <div style={styles.statSub}>{fmtUSD(uStats.todayCents / 100)}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statTitle}>{t('stats.payments.week')}</div>
                <div style={styles.statValue}>{uStats.weekCount}</div>
                <div style={styles.statSub}>{fmtUSD(uStats.weekCents / 100)}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statTitle}>{t('stats.payments.30')}</div>
                <div style={styles.statValue}>{uStats.monthCount}</div>
                <div style={styles.statSub}>{fmtUSD(uStats.monthCents / 100)}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statTitle}>{t('stats.payments.avg30')}</div>
                <div style={styles.statValue}>{fmtUSD(uStats.avg30Cents / 100)}</div>
              </div>
            </div>

            <div style={styles.modalNote}>{t('stats.note.user')}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: { padding: "20px", textAlign: "center", minHeight: "100vh", backgroundColor: "#f5f5f5" },
  loading: { textAlign: "center", padding: "50px", fontSize: "18px" },
  title: { color: "#333", marginBottom: "30px" },
  balanceCard: { backgroundColor: "white", padding: "20px", borderRadius: "10px", margin: "20px auto", maxWidth: "300px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" },
  balanceTitle: { margin: 0, color: "#666", fontSize: "16px" },
  balanceAmount: { margin: "10px 0", color: "#2196f3", fontSize: "32px" },
  saldoSection: { backgroundColor: "white", padding: "20px", borderRadius: "10px", margin: "20px auto", maxWidth: "300px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" },
  recargaButtons: { display: "flex", gap: "10px", marginTop: "15px", marginBottom: "15px" },
  recargaButton: { padding: "12px", backgroundColor: "#2196f3", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", flex: 1, fontSize: "16px", fontWeight: "bold" },
  customAmount: { display: "flex", gap: "10px", marginTop: "10px" },
  input: { padding: "10px", border: "1px solid #ddd", borderRadius: "8px", flex: 2, fontSize: "16px" },
  customButton: { padding: "10px", backgroundColor: "#4caf50", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", flex: 1, fontSize: "16px" },
  buttonGroup: { display: "flex", flexDirection: "column", gap: "15px", maxWidth: "300px", margin: "20px auto" },
  secondaryButton: { padding: "15px", backgroundColor: "#666", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "16px" },
  logoutButton: { padding: "12px 20px", backgroundColor: "#e74c3c", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "16px", marginTop: "20px" },

  // Modal
  modalBackdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 1000 },
  modal: { background: "#fff", borderRadius: 12, maxWidth: 520, width: "100%", padding: 16, boxShadow: "0 10px 25px rgba(0,0,0,0.2)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  closeBtn: { border: "none", background: "#eee", borderRadius: 8, padding: "6px 10px", cursor: "pointer" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 },
  statCard: { background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 },
  statTitle: { fontSize: 12, color: "#64748b" },
  statValue: { fontWeight: "bold", fontSize: 20, color: "#111827" },
  statSub: { fontSize: 12, color: "#64748b" },
  modalNote: { marginTop: 10, fontSize: 12, color: "#666" },
};

export default Dashboard;
