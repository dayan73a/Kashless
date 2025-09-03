// src/components/Payment.jsx
import { useState, useRef, useEffect } from "react";
import useBLEEnhanced from "../hooks/useBLEEnhanced";
import { doc, collection, addDoc, setDoc } from "firebase/firestore";
import { db, auth, ensureSignedIn } from "../firebase";

// ---------- Helpers para hacer el match tolerante ----------
function normalizeName(s = "") {
  return String(s).toLowerCase().replace(/[\s_-]+/g, "");
}
function extractNumber(s = "") {
  const m = String(s).match(/(\d+)/);
  return m ? m[1] : null;
}
function matchDevice(machineId, devices) {
  const t = normalizeName(machineId);        // ej: "lavadora01"
  const tNum = extractNumber(machineId);     // ej: "01" o "1"

  // 1) match directo/inclusión
  let found = devices.find(d => {
    const name = d.name || d.localName || d.deviceName || d.id || "";
    const n = normalizeName(name);           // ej: "kashlessmachine01"
    return n === t || n.includes(t) || t.includes(n);
  });
  if (found) return found;

  // 2) match por número (lavadora 01 ↔ Kashless_Machine_01)
  if (tNum) {
    found = devices.find(d => {
      const name = d.name || d.localName || d.deviceName || d.id || "";
      const nNum = extractNumber(name);
      return nNum && nNum === tNum;
    });
  }
  return found || null;
}

// ---------- Helpers de seguridad para callbacks ----------
const isFn = (f) => typeof f === "function";
const safeCall = (fn, ...args) => (isFn(fn) ? fn(...args) : undefined);

// ---------- Estilos (más contraste) ----------
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
  activateBtnDisabled: {
    opacity: 0.7,
    cursor: "not-allowed",
  },

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

const Payment = ({ amount, machineId, userId, onSuccess, onError }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const {
    devices,
    connectedDevice,
    isScanning,
    scanForDevices,
    connectToDevice,
    sendCommand,
    isWeb,
  } = useBLEEnhanced();

  // Mantener siempre la versión más nueva de `devices`
  const devicesRef = useRef(devices);
  useEffect(() => { devicesRef.current = devices; }, [devices]);

  const handlePaymentAndActivation = async () => {
    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      console.log("💳 Iniciando proceso de pago y activación...");

      // 1) Garantiza sesión y toma UID
      await ensureSignedIn();
      const uid = auth.currentUser?.uid || userId;
      if (!uid) throw new Error("Usuario no autenticado. Por favor, inicia sesión nuevamente.");

      // 2) BLE: busca y conecta (si no hay conexión)
      let device = connectedDevice;

      if (!device) {
        if (!navigator.bluetooth) {
          throw new Error("Este dispositivo/navegador no soporta Web Bluetooth.");
        }

        console.log("🔍 Buscando dispositivos BLE...");
        await scanForDevices();

        // Espera a que el hook pueble 'devices' (evita condiciones de carrera)
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
        for (let i = 0; i < 15; i++) { // ~4.5s máx
          if (!isScanning && devicesRef.current.length > 0) break;
          // eslint-disable-next-line no-await-in-loop
          await sleep(300);
        }
        // eslint-disable-next-line no-await-in-loop
        await sleep(200);

        const localDevices = devicesRef.current;
        console.log("📡 Dispositivos detectados:", localDevices);

        let targetDevice = matchDevice(machineId, localDevices);

        // Fallback: abre selector nativo más compatible (acceptAllDevices)
        if (!targetDevice) {
          try {
            console.log("🧭 Abriendo selector nativo Web Bluetooth (acceptAllDevices)...");
            const chosen = await navigator.bluetooth.requestDevice({
              acceptAllDevices: true,
              optionalServices: ["4fafc201-1fb5-459e-8fcc-c5c9c331914b"], // tu servicio GATT
            });

            targetDevice = {
              id: chosen.id,
              name: chosen.name,
              deviceName: chosen.name,
              gatt: chosen.gatt,
              __chosen: true,
            };
          } catch (e) {
            const available = localDevices.map(d => d.name || d.localName || d.deviceName || d.id).join(", ");
            throw new Error(`Máquina "${machineId}" no encontrada. Dispositivos disponibles: ${available || "ninguno"}`);
          }
        }

        console.log("🎯 Dispositivo elegido:", targetDevice.name || targetDevice.localName || targetDevice.deviceName || targetDevice.id);
        device = await connectToDevice(targetDevice);
      }

      // 3) Cálculo de tiempo (1 € = 5 min) — ajusta si tu lógica es distinta
      const minutes = Math.floor(Number(amount) * 5);
      if (!Number.isFinite(minutes) || minutes <= 0) {
        throw new Error("Monto inválido para calcular minutos.");
      }
      console.log(`⏰ Tiempo calculado: ${minutes} minutos por €${amount}`);

      // 4) Validaciones previas a activar
      if (typeof sendCommand !== "function") {
        throw new Error("Driver BLE no disponible: sendCommand no es función.");
      }

      // 5) Enviar comando a la máquina (formato que espera tu ESP32)
      console.log("📤 Enviando comando TIME...");
      await sendCommand(`TIME:${minutes}`);

      // 6) Persistencia en Firestore (tolerante)
      try {
        const now = new Date();
        const end = new Date(now.getTime() + minutes * 60000);

        const txRef = await addDoc(collection(db, "transactions"), {
          userId: uid,
          machineId,
          amount,
          minutes,
          startTime: now,
          endTime: end,
          status: "active",
          simulated: !!navigator.bluetooth, // solo indicador de entorno
        });

        await setDoc(
          doc(db, "machines", machineId),
          {
            status: "in-use",
            currentUser: uid,
            endTime: end,
            lastTransaction: txRef.id,
            updatedAt: now,
          },
          { merge: true }
        );

        console.log("💾 Transacción guardada en Firestore", txRef.id);
      } catch (firestoreError) {
        console.warn("⚠️ Error guardando en Firestore (no crítico para la activación):", firestoreError);
      }

      // 7) Éxito
      const result = {
        minutes,
        endTime: new Date(Date.now() + minutes * 60000),
        simulated: !!navigator.bluetooth,
      };
      setSuccess(`¡Máquina activada por ${minutes} minutos!`);
      safeCall(onSuccess, result); // ✅ no rompe si onSuccess no es función
      console.log("✅ Activación completada exitosamente");
    } catch (err) {
      console.error("❌ Error en activación:", err);
      const msg = err?.message || String(err);
      setError(msg);
      safeCall(onError, msg); // ✅ no rompe si onError no es función
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
          <p style={styles.label}><strong style={styles.strong}>Monto:</strong> €{amount}</p>
          <p style={styles.label}><strong style={styles.strong}>Tiempo:</strong> {Math.floor(Number(amount) * 5)} minutos</p>
          {navigator.bluetooth && <p style={styles.simulationWarning}>⚠️ Modo Web Bluetooth activo</p>}
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
            <h3 style={{ ...styles.title, marginBottom: 8 }}>Escaneando dispositivos BLE…</h3>
            {devicesRef.current.length === 0 ? (
              <p style={styles.label}>Buscando dispositivos Kashless…</p>
            ) : (
              <div style={styles.devicesList}>
                {devicesRef.current.map((d) => (
                  <div key={d.id} style={styles.deviceItem}>
                    <strong>{d.name || d.localName || d.deviceName || "Dispositivo sin nombre"}</strong>
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
