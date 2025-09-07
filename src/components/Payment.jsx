// src/components/Payment.jsx
import { useState, useRef, useEffect } from "react";
import useBLEEnhanced from "../hooks/useBLEEnhanced";
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db, auth, ensureSignedIn } from "../firebase";
import {
  debitWallet,
  creditWallet,
  ensureWalletDoc,
} from "../lib/wallet";

// 👇 Offline helpers
import { saveOfflineTx } from "../offline/storage";
import { syncOfflineTxs } from "../offline/reconciler";

/* ---------- Utils ---------- */
function fmtUSD(n) {
  const v = Number(n ?? 0);
  return `$${v.toFixed(2)}`;
}
function safeMsg(e) {
  if (!e) return "Error desconocido";
  if (typeof e === "string") return e;
  if (e?.message) return e.message;
  if (e?.code) return String(e.code);
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/* ---------- Matching BLE ---------- */
function normalizeName(s = "") {
  return String(s).toLowerCase().replace(/[\s_-]+/g, "");
}
function extractNumber(s = "") {
  const m = String(s).match(/(\d+)/);
  return m ? m[1] : null;
}
function matchDevice(machineId, devices) {
  const t = normalizeName(machineId);
  const tNum = extractNumber(machineId);

  let found = devices.find((d) => {
    const name = d.name || d.localName || d.deviceName || d.id || "";
    const n = normalizeName(name);
    return n === t || n.includes(t) || t.includes(n);
  });
  if (found) return found;

  if (tNum) {
    found = devices.find((d) => {
      const name = d.name || d.localName || d.deviceName || d.id || "";
      const nNum = extractNumber(name);
      return nNum && nNum === tNum;
    });
  }
  return found || null;
}

/* ---------- Estilos ---------- */
const styles = {
  pageBg: {
    background:
      "radial-gradient(1200px 600px at 10% -10%, #a5f3fc33, transparent 60%), radial-gradient(1200px 600px at 100% 0%, #93c5fd22, transparent 55%), #eef2f7",
    minHeight: "100vh",
    padding: "24px 12px",
  },
  paymentContainer: {
    padding: "0",
    maxWidth: "480px",
    margin: "0 auto",
    fontFamily: "Arial, sans-serif",
    color: "#1e293b",
  },
  title: {
    textAlign: "center",
    fontSize: "22px",
    fontWeight: 800,
    color: "#0f172a",
    margin: "0 0 16px",
  },
  card: {
    background: "#ffffff",
    padding: "20px",
    borderRadius: "14px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 24px rgba(2,6,23,.05)",
    marginBottom: "16px",
  },
  label: { margin: 0, color: "#475569" },
  strong: { color: "#0f172a" },
  simulationWarning: {
    color: "#b45309",
    fontWeight: "700",
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    padding: "10px 12px",
    borderRadius: "12px",
    margin: "10px 0 0",
  },
  activateBtn: {
    background: "linear-gradient(90deg, #16a34a, #22c55e)",
    color: "#ffffff",
    border: "none",
    padding: "14px 18px",
    borderRadius: "12px",
    fontSize: "16px",
    cursor: "pointer",
    fontWeight: 800,
    width: "100%",
    boxShadow: "0 8px 24px rgba(34,197,94,.35)",
    transition: "transform .18s ease, box-shadow .18s ease, opacity .2s ease",
  },
  activateBtnDisabled: { opacity: 0.7, cursor: "not-allowed" },
  scanningStatus: {
    marginTop: "8px",
    padding: "16px",
    background: "#f8fafc",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
  },
  devicesList: { marginTop: "10px", display: "grid", gap: "10px" },
  deviceItem: {
    padding: "10px",
    background: "#ffffff",
    borderRadius: "10px",
    border: "1px solid #e2e8f0",
    color: "#0f172a",
  },
  errorMessage: {
    color: "#991b1b",
    background: "#fee2e2",
    border: "1px solid #fecaca",
    padding: "12px",
    borderRadius: "12px",
    margin: "4px 0 0",
    fontWeight: 700,
  },
  successMessage: {
    color: "#14532d",
    background: "#dcfce7",
    border: "1px solid #bbf7d0",
    padding: "12px",
    borderRadius: "12px",
    margin: "4px 0 0",
    fontWeight: 700,
  },
};

/* ---------- Helpers de saldo ---------- */
function parseBalanceCents(data) {
  if (!data || typeof data !== "object") return 0;
  if (typeof data.balanceCents === "number") return data.balanceCents;
  if (typeof data.balance === "number") return Math.round(data.balance * 100);
  if (typeof data.saldo === "number") return Math.round(data.saldo * 100);
  if (data.wallet && typeof data.wallet.balanceCents === "number")
    return data.wallet.balanceCents;
  return 0;
}

async function migrateUserBalanceIfNeeded(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const d = snap.data();
  if (typeof d?.balanceCents === "number") return;

  let cents = undefined;
  if (typeof d?.balance === "number") cents = Math.round(d.balance * 100);
  else if (typeof d?.saldo === "number") cents = Math.round(d.saldo * 100);
  else if (d?.wallet && typeof d.wallet.balanceCents === "number")
    cents = d.wallet.balanceCents;

  if (typeof cents === "number") {
    await setDoc(
      ref,
      { balanceCents: cents, updatedAt: serverTimestamp() },
      { merge: true }
    );
  }
}

const Payment = ({ amount, machineId, userId, onSuccess, onError }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [balanceCents, setBalanceCents] = useState(null);

  const {
    devices,
    connectedDevice,
    isScanning,
    scanForDevices,
    connectToDevice,
    sendCommand,
    isWeb,
  } = useBLEEnhanced();

  const devicesRef = useRef(devices);
  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  // 👇 Sincronizar offline al iniciar y al volver internet
  useEffect(() => {
    window.addEventListener("online", syncOfflineTxs);
    syncOfflineTxs();
    return () => window.removeEventListener("online", syncOfflineTxs);
  }, []);

  // Lee saldo en vivo
  useEffect(() => {
    let unsub = null;
    (async () => {
      try {
        await ensureSignedIn();
        const uid0 = auth.currentUser?.uid || userId;
        if (!uid0) return;

        await ensureWalletDoc(uid0);
        await migrateUserBalanceIfNeeded(uid0);

        const ref = doc(db, "users", uid0);
        unsub = onSnapshot(
          ref,
          (snap) => {
            const cents = parseBalanceCents(snap.data());
            setBalanceCents(cents);
          },
          (err) => {
            console.warn("[Payment] Snapshot saldo error:", err);
          }
        );
      } catch (e) {
        console.warn("[Payment] No se pudo inicializar saldo:", e);
      }
    })();
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [userId]);

  const handlePaymentAndActivation = async () => {
    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    const costCents = Math.round(Number(amount) * 100);
    const minutes = Math.floor(Number(amount) * 5);

    let uid;
    let debited = false;

    try {
      await ensureSignedIn();
      uid = auth.currentUser?.uid || userId;
      if (!uid) throw new Error("Usuario no autenticado. Inicia sesión.");

      await ensureWalletDoc(uid);
      await migrateUserBalanceIfNeeded(uid);

      if (typeof balanceCents === "number" && balanceCents < costCents) {
        throw new Error(
          `Saldo insuficiente. Saldo: ${fmtUSD(
            balanceCents / 100
          )} · Requiere: ${fmtUSD(costCents / 100)}`
        );
      }

      const debitRes = await debitWallet(uid, costCents, {
        reason: "vend",
        machineId,
        amountUSD: Number(amount),
      });
      debited = true;

      if (typeof debitRes?.newBalanceCents === "number") {
        setBalanceCents(debitRes.newBalanceCents);
      }

      // BLE
      let device = connectedDevice;
      if (!device) {
        await scanForDevices();
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        for (let i = 0; i < 15; i++) {
          if (!isScanning && devicesRef.current.length > 0) break;
          await sleep(300);
        }
        await sleep(200);

        let localDevices = devicesRef.current;
        let targetDevice = matchDevice(machineId, localDevices);
        if (!targetDevice) {
          const chosen = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ["4fafc201-1fb5-459e-8fcc-c5c9c331914b"],
          });
          targetDevice = {
            id: chosen.id,
            name: chosen.name,
            deviceName: chosen.name,
            gatt: chosen.gatt,
            __chosen: true,
          };
        }
        device = await connectToDevice(targetDevice);
      }

      await sendCommand(`TIME:${minutes}`);

      // 👇 Preparar transacción
      const txData = {
        userId: uid,
        machineId,
        amount: Number(amount),
        amountCents: costCents,
        currency: "USD",
        minutes,
        startTime: new Date(),
        endTime: new Date(Date.now() + minutes * 60000),
        status: "active",
        paidWithWalletCents: costCents,
        simulated: isWeb,
      };

      // 👇 Guardar online u offline
      try {
        if (navigator.onLine) {
          await addDoc(collection(db, "transactions"), {
            ...txData,
            startTime: serverTimestamp(),
          });
        } else {
          saveOfflineTx(txData);
          console.warn("Transacción guardada offline");
        }

        await setDoc(
          doc(db, "machines", machineId),
          {
            status: "in-use",
            currentUser: uid,
            endTime: txData.endTime,
            lastTransaction: "pending-offline",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn("[Payment] Guardado Firestore NO crítico:", e);
        saveOfflineTx(txData);
      }

      setSuccess(`¡Máquina activada por ${minutes} minutos!`);
      onSuccess?.({
        minutes,
        endTime: txData.endTime,
        simulated: isWeb,
        debitedCents: costCents,
        newBalanceCents:
          typeof debitRes?.newBalanceCents === "number"
            ? debitRes.newBalanceCents
            : undefined,
      });
    } catch (err) {
      const msg = safeMsg(err);
      setError(msg);
      onError?.(msg);

      if (debited && uid) {
        try {
          const refunded = await creditWallet(uid, costCents, {
            reason: "refund_failed_vend",
            machineId,
            amountUSD: Number(amount),
          });
          if (typeof refunded === "number") setBalanceCents(refunded);
        } catch (reErr) {
          console.error("Error al reembolsar:", reErr);
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={styles.pageBg}>
      <div style={styles.paymentContainer}>
        <div style={styles.card}>
          <h2 style={styles.title}>Activar Máquina {machineId}</h2>
          <p style={styles.label}>Confirma el pago para iniciar el tiempo</p>
        </div>

        <div style={styles.card}>
          <p style={styles.label}>
            <strong style={styles.strong}>Monto:</strong>{" "}
            {fmtUSD(Number(amount))}
          </p>
          <p style={styles.label}>
            <strong style={styles.strong}>Tiempo:</strong>{" "}
            {Math.floor(Number(amount) * 5)} minutos
          </p>
          {typeof balanceCents === "number" && (
            <p style={styles.label}>
              <strong style={styles.strong}>Saldo:</strong>{" "}
              {fmtUSD(balanceCents / 100)}
            </p>
          )}
          {isWeb && (
            <p style={styles.simulationWarning}>
              ⚠️ Modo simulación (Web Bluetooth)
            </p>
          )}
        </div>

        {error && (
          <div style={styles.errorMessage}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {success && (
          <div style={styles.successMessage}>
            <strong>¡Éxito!</strong> {success}
          </div>
        )}

        <button
          onClick={handlePaymentAndActivation}
          disabled={isProcessing || isScanning}
          style={
            isProcessing || isScanning
              ? { ...styles.activateBtn, ...styles.activateBtnDisabled }
              : styles.activateBtn
          }
        >
          {isProcessing
            ? "Procesando..."
            : isScanning
            ? "Buscando máquina..."
            : "Pagar y Activar"}
        </button>

        {isScanning && (
          <div style={{ ...styles.card, ...styles.scanningStatus }}>
            <h3 style={{ ...styles.title, marginBottom: 8 }}>
              Escaneando dispositivos BLE…
            </h3>
            {devicesRef.current.length === 0 ? (
              <p style={styles.label}>Buscando dispositivos Kashless…</p>
            ) : (
              <div style={styles.devicesList}>
                {devicesRef.current.map((d) => (
                  <div key={d.id} style={styles.deviceItem}>
                    <strong>
                      {d.name ||
                        d.localName ||
                        d.deviceName ||
                        "Dispositivo sin nombre"}
                    </strong>
                    <br />
                    <small style={{ color: "#475569" }}>ID: {d.id}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Payment;
