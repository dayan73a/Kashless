import { useState, useEffect } from "react";
import useBLEEnhanced from "../hooks/useBLEEnhanced";
import { updateDoc, doc, collection, addDoc } from "firebase/firestore";
import { db } from "../firebase";

// ✅ Estilos inline
const styles = {
  paymentContainer: {
    padding: "20px",
    maxWidth: "400px",
    margin: "0 auto",
    textAlign: "center",
    fontFamily: "Arial, sans-serif",
  },
  paymentInfo: {
    background: "white",
    padding: "20px",
    borderRadius: "10px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
    marginBottom: "20px",
  },
  simulationWarning: {
    color: "#ff9800",
    fontWeight: "bold",
    background: "#fff3e0",
    padding: "8px",
    borderRadius: "5px",
    margin: "10px 0",
  },
  activateBtn: {
    background: "#4caf50",
    color: "white",
    border: "none",
    padding: "15px 30px",
    borderRadius: "8px",
    fontSize: "16px",
    cursor: "pointer",
    fontWeight: "bold",
    width: "100%",
    transition: "background-color 0.3s",
  },
  activateBtnDisabled: {
    background: "#ccc",
    cursor: "not-allowed",
  },
  scanningStatus: {
    marginTop: "20px",
    padding: "15px",
    background: "#f8f9fa",
    borderRadius: "8px",
    borderLeft: "4px solid #007bff",
  },
  devicesList: {
    marginTop: "10px",
  },
  deviceItem: {
    padding: "10px",
    margin: "5px 0",
    background: "white",
    borderRadius: "6px",
    border: "1px solid #dee2e6",
    textAlign: "left",
  },
  errorMessage: {
    color: "#d32f2f",
    background: "#ffebee",
    padding: "10px",
    borderRadius: "5px",
    margin: "10px 0",
  },
  successMessage: {
    color: "#2e7d32",
    background: "#e8f5e9",
    padding: "10px",
    borderRadius: "5px",
    margin: "10px 0",
  }
};

const Payment = ({ amount, machineId, userId, onSuccess, onError }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanCompleted, setScanCompleted] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const {
    devices,
    connectedDevice,
    isScanning,
    scanForDevices,
    connectToDevice,
    sendCommand,
    findDeviceByName,
    isWeb,
  } = useBLEEnhanced();

  // Efecto para detectar cuando el escaneo ha finalizado
  useEffect(() => {
    if (!isScanning && devices.length > 0) {
      setScanCompleted(true);
    }
  }, [isScanning, devices]);

  const handlePaymentAndActivation = async () => {
    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      console.log("💳 Iniciando proceso de pago y activación...");

      // Validar que tenemos userId
      if (!userId) {
        throw new Error("Usuario no autenticado. Por favor, inicia sesión nuevamente.");
      }

      let device = connectedDevice;

      if (!device) {
        console.log("🔍 Buscando dispositivos BLE...");
        
        // Iniciar escaneo
        await scanForDevices();
        
        // Esperar a que el escaneo se complete
        let attempts = 0;
        while (isScanning && attempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
        }

        console.log("📡 Dispositivos detectados:", devices);

        // ✅ Usar la nueva función findDeviceByName para buscar coincidencia exacta
        const targetDevice = findDeviceByName(machineId);
        
        if (!targetDevice) {
          const availableDevices = devices.map(d => d.name || d.localName || d.deviceName || d.id).join(", ");
          throw new Error(
            `Máquina "${machineId}" no encontrada. Dispositivos disponibles: ${availableDevices || "ninguno"}`
          );
        }

        console.log("🎯 Dispositivo encontrado:", targetDevice.name || targetDevice.localName || targetDevice.deviceName);
        device = await connectToDevice(targetDevice);
      }

      const minutes = Math.floor(amount * 5);
      console.log(`⏰ Tiempo calculado: ${minutes} minutos por €${amount}`);

      console.log("📤 Enviando comando TIME...");
      await sendCommand(`TIME:${minutes}`);

      // Guardar en Firestore (tanto para web como móvil en modo simulación)
      try {
        const transactionRef = await addDoc(collection(db, "transactions"), {
          userId: userId,
          machineId,
          amount,
          minutes,
          startTime: new Date(),
          endTime: new Date(Date.now() + minutes * 60000),
          status: "active",
          simulated: isWeb, // Indicar si es una simulación
        });

        await updateDoc(doc(db, "machines", machineId), {
          status: "in-use",
          currentUser: userId,
          endTime: new Date(Date.now() + minutes * 60000),
          lastTransaction: transactionRef.id,
        });

        console.log("💾 Transacción guardada en Firestore", transactionRef.id);
      } catch (firestoreError) {
        console.warn("⚠️ Error guardando en Firestore (puede ser normal en desarrollo):", firestoreError);
        // No lanzamos error porque puede ser una simulación sin conexión a Firestore
      }

      const result = {
        minutes,
        endTime: new Date(Date.now() + minutes * 60000),
        simulated: isWeb,
      };
      
      setSuccess(`¡Máquina activada por ${minutes} minutos!`);
      onSuccess(result);

      console.log("✅ Activación completada exitosamente");
    } catch (error) {
      console.error("❌ Error en activación:", error);
      setError(error.message);
      onError(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={styles.paymentContainer}>
      <h2>Activar Máquina {machineId}</h2>

      <div style={styles.paymentInfo}>
        <p>
          <strong>Monto:</strong> €{amount}
        </p>
        <p>
          <strong>Tiempo:</strong> {Math.floor(amount * 5)} minutos
        </p>
        {isWeb && (
          <p style={styles.simulationWarning}>⚠️ Modo simulación (Web)</p>
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
        <div style={styles.scanningStatus}>
          <h3>Escaneando dispositivos BLE...</h3>
          {devices.length === 0 ? (
            <p>Buscando dispositivos Kashless...</p>
          ) : (
            <div style={styles.devicesList}>
              <p>Dispositivos encontrados:</p>
              {devices.map((device) => (
                <div key={device.id} style={styles.deviceItem}>
                  <strong>{device.name || device.localName || device.deviceName || "Dispositivo sin nombre"}</strong>
                  <br />
                  <small>ID: {device.id}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Payment;