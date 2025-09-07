import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { activateMachine } from '../lib/ble';


const Confirmacion = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Datos de la transacción exitosa
  const { amount, businessName, serviceName } = location.state || {};
  const cents = Math.round((amount || 0) * 100);

  if (!location.state) {
    return (
      <div style={styles.container}>
        <div style={styles.errorIcon}>❌</div>
        <h2>Error en la transacción</h2>
        <p>No se encontraron datos de confirmación</p>
        <button 
          style={styles.secondaryButton}
          onClick={() => navigate('/dashboard')}
        >
          Volver al Dashboard
        </button>
      </div>
    );
  }

  const handleActivate = async () => {
    try {
      await activateMachine(cents); // 👈 gesto del usuario
      alert("Máquina activada ✅");
    } catch (e) {
      alert(e?.message || "No se pudo activar la máquina");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.successIcon}>🎉</div>
      <h2 style={styles.successTitle}>¡Pago Exitoso!</h2>
      
      <div style={styles.transactionDetails}>
        <div style={styles.detailCard}>
          <h3>📋 Resumen de la transacción</h3>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Negocio:</span>
            <span style={styles.detailValue}>{businessName || 'Negocio'}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Servicio:</span>
            <span style={styles.detailValue}>{serviceName || 'Servicio'}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Monto pagado:</span>
            <span style={styles.detailValue}>${amount?.toFixed(2)}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Comisión (5%):</span>
            <span style={styles.detailValue}>${(amount * 0.05).toFixed(2)}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Recibió el negocio:</span>
            <span style={styles.detailValue}>${(amount * 0.95).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div style={styles.successMessage}>
        <p>✅ Transacción completada correctamente</p>
        <p>📧 Recibirás un comprobante por correo electrónico</p>
        <p>💾 El registro se ha guardado en tu historial</p>
      </div>

      <div style={styles.buttonGroup}>
        {/* 🔌 Botón para activar la máquina por BLE */}
        <button 
          style={styles.primaryButton}
          onClick={handleActivate}
        >
          ⚡ Conectar y activar máquina
        </button>

        <button 
          style={styles.primaryButton}
          onClick={() => navigate('/scanner')}
        >
          📷 Escanear otro código
        </button>
        
        <button 
          style={styles.secondaryButton}
          onClick={() => navigate('/history')}
        >
          📋 Ver historial
        </button>
        
        <button 
          style={styles.tertiaryButton}
          onClick={() => navigate('/dashboard')}
        >
          🏠 Volver al inicio
        </button>
      </div>

      <div style={styles.securityNote}>
        <p>🔒 Transacción segura | ✅ Certificado SSL | 🛡️ Protección de datos</p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    textAlign: 'center',
    minHeight: '100vh',
    backgroundColor: '#f0f9f0',
    fontFamily: 'Arial, sans-serif'
  },
  successIcon: {
    fontSize: '80px',
    margin: '20px 0',
    animation: 'bounce 1s infinite'
  },
  successTitle: {
    color: '#27ae60',
    fontSize: '28px',
    margin: '10px 0 30px 0'
  },
  transactionDetails: {
    maxWidth: '400px',
    margin: '0 auto 30px'
  },
  detailCard: {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '12px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
    textAlign: 'left'
  },
 detailRow: {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 0',
  borderBottom: '1px solid #eee'
},

  detailLabel: {
    fontWeight: 'bold',
    color: '#555'
  },
  detailValue: {
    color: '#2c3e50',
    fontWeight: 'bold'
  },
  successMessage: {
    backgroundColor: '#e8f5e8',
    padding: '15px',
    borderRadius: '8px',
    margin: '20px auto',
    maxWidth: '400px',
    color: '#2e7d32'
  },
  buttonGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxWidth: '300px',
    margin: '30px auto'
  },
  primaryButton: {
    padding: '16px',
    backgroundColor: '#27ae60',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  secondaryButton: {
    padding: '16px',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    cursor: 'pointer'
  },
  tertiaryButton: {
    padding: '16px',
    backgroundColor: '#95a5a6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    cursor: 'pointer'
  },
  errorIcon: {
    fontSize: '60px',
    margin: '20px 0',
    color: '#e74c3c'
  },
  securityNote: {
    marginTop: '30px',
    padding: '15px',
    backgroundColor: '#e3f2fd',
    borderRadius: '8px',
    color: '#1976d2',
    fontSize: '12px',
    maxWidth: '400px',
    margin: '20px auto'
  }
};

export default Confirmacion;
