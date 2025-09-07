// src/components/QrScanner.jsx
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import Payment from "./Payment";
import { useI18n } from "../context/I18nContext.jsx";

// Helpers
const fmtUSD = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function parseMachine(code) {
  const id = String(code).trim();
  const low = id.toLowerCase();

  let price = 2.0;
  let name = id;
  let type = "machine";

  if (low.includes("lavadora")) {
    type = "washer";
    name = `Lavadora ${id.split("_").pop() || ""}`.trim();
    price = 2.25;
  } else if (low.includes("secadora")) {
    type = "dryer";
    name = `Secadora ${id.split("_").pop() || ""}`.trim();
    price = 1.50;
  } else if (low.includes("kashless")) {
    type = "washing_machine";
    name = id;
    price = 2.00;
  }

  return { id, name, type, price };
}

const containerStyle = {
  padding: "20px",
  textAlign: "center",
  backgroundColor: "#f5f5f5",
  fontFamily: "Arial, sans-serif",
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  overflow: "auto",
};

export default function QrScanner({ user, onClose }) {
  const { t } = useI18n();
  const [error, setError] = useState(null);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [starting, setStarting] = useState(true);

  const html5Ref = useRef(null);
  const divIdRef = useRef(`qr-reader-port-${Math.random().toString(36).slice(2)}`);
  const stoppedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function start() {
      try {
        setError(null);
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(t('camera.error.noaccess'));
        }

        html5Ref.current = new Html5Qrcode(divIdRef.current, { verbose: false });

        // 1) facingMode exact
        try { await startWithConfig({ facingMode: { exact: "environment" } }); return; } catch(_){}
        // 2) facingMode ideal
        try { await startWithConfig({ facingMode: "environment" }); return; } catch(_){}
        // 3) enumerar y elegir trasera
        const cameras = await Html5Qrcode.getCameras();
        if (!mounted) return;
        const backCam =
          cameras.find((c) => /back|rear|environment/i.test(c.label)) ||
          cameras[cameras.length - 1];
        if (!backCam) throw new Error("No camera found.");
        await startWithConfig({ deviceId: { exact: backCam.id } });
      } catch (e) {
        console.error(e);
        setError(e?.message || String(e));
      } finally {
        setStarting(false);
      }
    }

    const startWithConfig = async (cameraConfig) => {
      const scanConfig = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };
      await html5Ref.current.start(
        cameraConfig,
        scanConfig,
        (decodedText) => {
          if (stoppedRef.current) return;
          stoppedRef.current = true;
          stop().finally(() => {
            const machine = parseMachine(decodedText);
            setSelectedMachine(machine);
          });
        },
        () => {}
      );
    };

    async function stop() {
      try { await html5Ref.current?.stop(); } catch {}
      try { await html5Ref.current?.clear(); } catch {}
    }

    start();
    return () => { mounted = false; stop(); };
  }, [t]);

  if (selectedMachine) {
    return (
      <Payment
        amount={selectedMachine.price}
        machineId={selectedMachine.id}
        userId={user?.uid}
        onSuccess={() => onClose?.()}
        onError={(err) => {
          alert(`❌ Error: ${err}`);
          window.location.reload();
        }}
      />
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ margin: "0 auto", maxWidth: 420, background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, color: "#333" }}>{t('qr.title')}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#666" }}>✕</button>
        </div>

        {error ? (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "#ffebee", color: "#c62828" }}>
            {error}
          </div>
        ) : null}

        <div style={{ marginTop: 16 }}>
          <div id={divIdRef.current} style={{ width: "100%", minHeight: 280, background: "#000", borderRadius: 12, overflow: "hidden" }} />
          <p style={{ color: "#666", marginTop: 10 }}>
            {starting ? t('qr.initializing') : t('qr.point')}
          </p>
        </div>

        <ManualCodeFallback
          t={t}
          onSubmitCode={(code) => {
            const machine = parseMachine(code);
            setSelectedMachine(machine);
          }}
        />
      </div>
    </div>
  );
}

function ManualCodeFallback({ onSubmitCode, t }) {
  const [v, setV] = useState("");
  return (
    <div style={{ marginTop: 16, background: "#f8f8f8", padding: 12, borderRadius: 10 }}>
      <p style={{ margin: "4px 0 10px", color: "#333" }}>{t('qr.manual.title')}</p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder={t('qr.manual.placeholder')}
          style={{ flex: 1, padding: "12px 10px", border: "2px solid #ddd", borderRadius: 8, fontSize: 16, textAlign: "center" }}
        />
        <button
          onClick={() => v && onSubmitCode(v.trim())}
          style={{ padding: "12px 16px", background: "#4caf50", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
        >
          {t('qr.manual.activate')}
        </button>
      </div>
      <p style={{ color: "#777", fontSize: 12, marginTop: 8 }}>
        {t('qr.manual.note', { price: fmtUSD(2) })}
      </p>
    </div>
  );
}
