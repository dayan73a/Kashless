// src/components/Dashboard.jsx
import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, increment, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import app, { auth, db } from '../firebase';        // 👈 OJO la ruta: ../firebase
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const [userData, setUserData] = useState({ saldo_general: 0 });
  const [loading, setLoading] = useState(true);
  const [customAmount, setCustomAmount] = useState(0);
  const navigate = useNavigate();

  // Cargar saldo del usuario
  const loadSaldo = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      }
    } catch (error) {
      console.error("Error cargando saldo:", error);
    }
    setLoading(false);
  };

  // Función para recargar saldo
  const recargarSaldo = async (monto) => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const nuevoSaldo = (userData.saldo_general || 0) + monto;

        // 1) Incrementa en servidor
        await updateDoc(userRef, { saldo_general: increment(monto) });

        // 2) Registro en historial
        await addDoc(collection(db, 'transactions'), {
          usuario: user.uid,
          tipo: "recarga",
          monto,
          fecha: serverTimestamp(),
          detalle: `Recarga de saldo - $${monto}`,
          saldo_resultante: nuevoSaldo,
          email: user.email || null,
        });

        // 3) Actualiza UI
        setUserData(prev => ({ ...prev, saldo_general: nuevoSaldo }));
        alert(`¡Recarga exitosa de $${monto}!`);
        setCustomAmount(0);
      }
    } catch (error) {
      console.error("Error recargando saldo:", error);
      alert("Error al recargar saldo");
    }
  };

  // Cerrar sesión
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
      alert('Sesión cerrada correctamente');
    } catch (error) {
      console.error('Error cerrando sesión:', error);
      alert('Error al cerrar sesión');
    }
  };

  useEffect(() => {
    loadSaldo();
  }, []);

  if (loading) return <div style={styles.loading}>Cargando saldo...</div>;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Mi Cuenta Kashless</h2>

      <div style={styles.balanceCard}>
        <h3 style={styles.balanceTitle}>Mi Saldo</h3>
        <h1 style={styles.balanceAmount}>
          ${ (userData.saldo_general ?? 0).toFixed(2) }
        </h1>
      </div>

      <div style={styles.saldoSection}>
        <h3>Recargar Saldo</h3>
        <div style={styles.recargaButtons}>
          <button onClick={() => recargarSaldo(20)} style={styles.recargaButton}>$20</button>
          <button onClick={() => recargarSaldo(50)} style={styles.recargaButton}>$50</button>
          <button onClick={() => recargarSaldo(100)} style={styles.recargaButton}>$100</button>
        </div>
        <div style={styles.customAmount}>
          <input
            type="number"
            placeholder="Otro monto"
            style={styles.input}
            value={customAmount || ''}
            onChange={(e) => setCustomAmount(Number(e.target.value))}
          />
          <button
            onClick={() => customAmount > 0 && recargarSaldo(customAmount)}
            style={styles.customButton}
            disabled={customAmount <= 0}
          >
            Recargar
          </button>
        </div>
      </div>

      <div style={styles.buttonGroup}>
        <button style={styles.secondaryButton} onClick={() => navigate('/scanner')}>
          📷 Escáner QR
        </button>
        <button style={styles.secondaryButton} onClick={() => navigate('/history')}>
          📋 Historial de Transacciones
        </button>
        <button
          style={styles.secondaryButton}
          onClick={() => {
            if (userData.es_dueno) {
              navigate('/business-dashboard');
            } else {
              alert("📊 Próximamente: Aquí verás tus estadísticas de uso");
            }
          }}
        >
          {userData.es_dueno ? "🏪 Mi Panel de Negocio" : "📊 Estadísticas"}
        </button>
      </div>

      <button onClick={handleLogout} style={styles.logoutButton}>
        🚪 Cerrar Sesión
      </button>
    </div>
  );
};

const styles = {
  container: { padding: '20px', textAlign: 'center', minHeight: '100vh', backgroundColor: '#f5f5f5' },
  loading: { textAlign: 'center', padding: '50px', fontSize: '18px' },
  title: { color: '#333', marginBottom: '30px' },
  balanceCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', margin: '20px auto', maxWidth: '300px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  balanceTitle: { margin: 0, color: '#666', fontSize: '16px' },
  balanceAmount: { margin: '10px 0', color: '#2196f3', fontSize: '32px' },
  saldoSection: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', margin: '20px auto', maxWidth: '300px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  recargaButtons: { display: 'flex', gap: '10px', marginTop: '15px', marginBottom: '15px' },
  recargaButton: { padding: '12px', backgroundColor: '#2196f3', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', flex: 1, fontSize: '16px', fontWeight: 'bold' },
  customAmount: { display: 'flex', gap: '10px', marginTop: '10px' },
  input: { padding: '10px', border: '1px solid #ddd', borderRadius: '8px', flex: 2, fontSize: '16px' },
  customButton: { padding: '10px', backgroundColor: '#4caf50', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', flex: 1, fontSize: '16px' },
  buttonGroup: { display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '300px', margin: '20px auto' },
  secondaryButton: { padding: '15px', backgroundColor: '#666', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' },
  logoutButton: { padding: '12px 20px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', marginTop: '20px' },
};

export default Dashboard;
