import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Payment from './Payment';

const QrScanner = ({ user, onClose }) => {
  const [scanResult, setScanResult] = useState(null);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [isScanning, setIsScanning] = useState(true);
  const [error, setError] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const scannerRef = useRef(null);

  useEffect(() => {
    // Solo inicializar el escáner si estamos escaneando y no hay un escáner activo
    if (isScanning && !scannerRef.current) {
      const scanner = new Html5QrcodeScanner('qr-reader', {
        qrbox: { width: 250, height: 250 },
        fps: 5,
      });

      scannerRef.current = scanner;

      scanner.render(
        (result) => {
          console.log('✅ QR escaneado:', result);
          processScannedCode(result);
          // No limpiamos inmediatamente, dejamos que el efecto de limpieza se encargue
        },
        (err) => {
          // Los errores de escaneo son normales, no mostramos nada a menos que sea crítico
          if (!err.includes('NotFoundException')) {
            console.warn('Advertencia de escáner:', err);
          }
        }
      );
    }

    // Función de limpieza
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch((err) => {
          console.warn('⚠️ Error limpiando scanner:', err);
        });
        scannerRef.current = null;
      }
    };
  }, [isScanning]);

  const processScannedCode = (code) => {
    try {
      // Detener el escaneo inmediatamente después de un resultado
      setIsScanning(false);
      
      let machineData;
      const codeLower = code.toLowerCase();

      // Verificar si es una máquina Kashless (nuevo formato)
      if (codeLower.includes('kashless')) {
        machineData = {
          id: code,
          type: 'washing_machine',
          price: 5.0, // Precio por defecto para máquinas Kashless
          name: code, // Usar el código completo como nombre
        };
      }
      // Mantener compatibilidad con formatos anteriores
      else if (codeLower.includes('lavadora')) {
        machineData = {
          id: code,
          type: 'washer',
          price: 2.0,
          name: `Lavadora ${code.split('_').pop() || '1'}`,
        };
      } else if (codeLower.includes('secadora')) {
        machineData = {
          id: code,
          type: 'dryer',
          price: 1.5,
          name: `Secadora ${code.split('_').pop() || '1'}`,
        };
      } else {
        // Formato genérico para otros tipos de máquinas
        machineData = {
          id: code,
          type: 'machine',
          price: 2.0,
          name: `Máquina ${code}`,
        };
      }

      setScanResult(machineData);
      setError(null);
    } catch (e) {
      console.error('Error procesando código:', e);
      setError('⚠️ Código no válido');
      setTimeout(() => {
        setError(null);
        setIsScanning(true); // Reactivar el escaneo después del error
      }, 3000);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualCode.trim()) {
      processScannedCode(manualCode.trim());
    }
  };

  const handlePaymentSuccess = (result) => {
    alert(`✅ ${selectedMachine.name} activada! ${result.minutes} minutos de uso`);
    onClose();
  };

  const handlePaymentError = (err) => {
    alert(`❌ Error: ${err}`);
    // No reiniciamos automáticamente, permitimos al usuario decidir
  };

  const handleRetryScan = () => {
    setScanResult(null);
    setSelectedMachine(null);
    setError(null);
    setIsScanning(true);
  };

  // Si tenemos una máquina seleccionada, mostrar el componente de pago
  if (selectedMachine) {
    return (
      <Payment
        amount={selectedMachine.price}
        machineId={selectedMachine.id}
        userId={user?.uid}
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
      />
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Escanear código QR</h2>
        <button onClick={onClose} style={styles.closeButton}>✕</button>
      </div>

      {error && (
        <div style={styles.error}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={styles.closeError}>✕</button>
        </div>
      )}

      {isScanning ? (
        <>
          <div style={styles.scannerContainer}>
            <div id="qr-reader"></div>
            <p style={styles.scannerText}>Enfoca el código QR de la máquina</p>
          </div>

          <div style={styles.manualSection}>
            <h3 style={styles.sectionTitle}>O ingresa el código manualmente</h3>
            <form onSubmit={handleManualSubmit} style={styles.form}>
              <input
                type="text"
                placeholder="Ej: Kashless_Machine_01, lavadora_01"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                style={styles.input}
              />
              <button type="submit" style={styles.manualButton}>
                ✅ Activar máquina
              </button>
            </form>
          </div>
        </>
      ) : scanResult ? (
        <div style={styles.scanResult}>
          <h3 style={styles.sectionTitle}>Máquina detectada:</h3>
          <p><strong>Nombre:</strong> {scanResult.name}</p>
          <p><strong>Tipo:</strong> {scanResult.type}</p>
          <p><strong>Precio:</strong> €{scanResult.price}</p>

          <div style={styles.scanActions}>
            <button 
              onClick={() => setSelectedMachine(scanResult)} 
              style={styles.confirmButton}
            >
              ✅ Activar esta máquina
            </button>
            <button onClick={handleRetryScan} style={styles.retryButton}>
              🔄 Escanear otro código
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    textAlign: 'center',
    backgroundColor: '#f5f5f5',
    fontFamily: 'Arial, sans-serif',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    overflow: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    padding: '15px 20px',
    backgroundColor: 'white',
    borderRadius: '10px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  title: { 
    margin: 0, 
    color: '#333',
    fontSize: '1.5rem'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '5px',
    color: '#666',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    backgroundColor: '#ffebee',
    color: '#d32f2f',
    padding: '15px',
    borderRadius: '8px',
    margin: '20px auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: '400px',
  },
  closeError: {
    background: 'none',
    border: 'none',
    color: '#d32f2f',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '0',
    width: '24px',
    height: '24px',
  },
  scannerContainer: { 
    margin: '20px auto', 
    maxWidth: '400px', 
    textAlign: 'center',
    padding: '15px',
    backgroundColor: 'white',
    borderRadius: '10px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  scannerText: { 
    margin: '10px 0', 
    color: '#666',
    fontSize: '0.9rem'
  },
  manualSection: {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '15px',
    margin: '20px auto',
    maxWidth: '400px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  },
  sectionTitle: { 
    color: '#333', 
    marginBottom: '20px',
    fontSize: '1.2rem'
  },
  form: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '15px' 
  },
  input: {
    padding: '15px',
    border: '2px solid #ddd',
    borderRadius: '8px',
    fontSize: '16px',
    textAlign: 'center',
  },
  manualButton: {
    padding: '15px',
    backgroundColor: '#4caf50',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    transition: 'background-color 0.2s',
  },
  scanResult: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '15px',
    margin: '40px auto',
    maxWidth: '400px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  },
  scanActions: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '10px', 
    marginTop: '20px' 
  },
  confirmButton: {
    padding: '15px',
    backgroundColor: '#4caf50',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'background-color 0.2s',
  },
  retryButton: {
    padding: '12px',
    backgroundColor: '#666',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
};

// Añadir estilos de hover para una mejor experiencia de usuario
Object.assign(styles.closeButton, {
  ':hover': {
    backgroundColor: '#f0f0f0'
  }
});

Object.assign(styles.manualButton, {
  ':hover': {
    backgroundColor: '#388e3c'
  }
});

Object.assign(styles.confirmButton, {
  ':hover': {
    backgroundColor: '#388e3c'
  }
});

Object.assign(styles.retryButton, {
  ':hover': {
    backgroundColor: '#555'
  }
});

export default QrScanner;