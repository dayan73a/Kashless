// src/components/TopUp.jsx
import { useEffect, useState } from "react";
import { auth, db, ensureSignedIn } from "../firebase";
import {
  doc,
  onSnapshot,
  addDoc,
  collection,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { ensureWalletDoc, creditWallet } from "../lib/wallet";

function fmtUSD(n) {
  const v = Number(n ?? 0);
  return `$${v.toFixed(2)}`;
}
function parseBalanceCents(data) {
  if (!data || typeof data !== "object") return 0;
  if (typeof data.balanceCents === "number") return data.balanceCents;
  if (typeof data.balance === "number") return Math.round(data.balance * 100);
  if (typeof data.saldo === "number") return Math.round(data.saldo * 100);
  if (data.wallet && typeof data.wallet.balanceCents === "number")
    return data.wallet.balanceCents;
  return 0;
}

export default function TopUp() {
  const [balanceCents, setBalanceCents] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let unsub = null;
    (async () => {
      try {
        await ensureSignedIn();
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        await ensureWalletDoc(uid);

        const ref = doc(db, "users", uid);
        unsub = onSnapshot(
          ref,
          (snap) => {
            setBalanceCents(parseBalanceCents(snap.data()));
          },
          (e) => {
            console.warn("[TopUp] snapshot error:", e);
          }
        );
      } catch (e) {
        console.warn("[TopUp] init error:", e);
      }
    })();
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  async function doTopUp(amountUSD) {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      await ensureSignedIn();
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("No autenticado.");

      await ensureWalletDoc(uid);

      // 1) Acreditar saldo (DEV: sin pasarela)
      const cents = Math.round(Number(amountUSD) * 100);
      const newBal = await creditWallet(uid, cents, {
        source: "dev_topup_button",
        bonus: 0,
      });

      // 2) Registrar transacción de recarga (para tu historial)
      await addDoc(collection(db, "transactions"), {
        userId: uid,
        tipo: "recarga",          // compat con tu historial viejo
        amount: Number(amountUSD),
        amountCents: cents,
        currency: "USD",
        detalle: `Recarga manual DEV ${fmtUSD(amountUSD)}`,
        startTime: serverTimestamp(),
        status: "settled",
        balanceAfter: newBal / 100,
      });

      // (Opcional) espejo del saldo en el doc user en USD para UI antiguas
      await setDoc(
        doc(db, "users", uid),
        { balance: newBal / 100, updatedAt: serverTimestamp() },
        { merge: true }
      );

      setMsg(`Recargados ${fmtUSD(amountUSD)}. Nuevo saldo: ${fmtUSD(newBal / 100)}`);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h2 style={styles.title}>Recargar billetera</h2>

        <p style={styles.label}>
          Saldo actual:{" "}
          <strong>{fmtUSD((balanceCents ?? 0) / 100)}</strong>
        </p>

        {msg && <div style={styles.ok}>{msg}</div>}
        {err && <div style={styles.bad}>{err}</div>}

        <div style={styles.row}>
          <button style={styles.btn} disabled={busy} onClick={() => doTopUp(5)}>
            + {fmtUSD(5)}
          </button>
          <button style={styles.btn} disabled={busy} onClick={() => doTopUp(10)}>
            + {fmtUSD(10)}
          </button>
          <button style={styles.btn} disabled={busy} onClick={() => doTopUp(20)}>
            + {fmtUSD(20)}
          </button>
        </div>

        <p style={styles.note}>
          * Modo DEV: estas recargas no pasan por pasarela. En producción se
          moverá a Stripe/Braintree con Cloud Functions.
        </p>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: 24,
  },
  card: {
    maxWidth: 420,
    margin: "0 auto",
    background: "#fff",
    padding: 20,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
  },
  title: { margin: "0 0 12px", color: "#111827" },
  label: { margin: "8px 0 20px", color: "#374151" },
  row: { display: "flex", gap: 12 },
  btn: {
    flex: 1,
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#111827",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  ok: {
    background: "#e9fbe9",
    color: "#14532d",
    border: "1px solid #86efac",
    padding: "10px 12px",
    borderRadius: 10,
    margin: "8px 0",
    fontWeight: 700,
  },
  bad: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    padding: "10px 12px",
    borderRadius: 10,
    margin: "8px 0",
    fontWeight: 700,
  },
  note: { marginTop: 14, color: "#6b7280", fontSize: 13 },
};
