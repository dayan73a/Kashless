import { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import app from '../firebase';
import { useNavigate } from 'react-router-dom';

const TransactionHistory = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const auth = getAuth(app);
  const db = getFirestore(app);

  // Cargar transacciones del usuario
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      navigate('/');
      return;
    }

    // Crear query para obtener transacciones del usuario actual, ordenadas por fecha
    const q = query(
      collection(db, 'transactions'),
      where('usuario', '==', user.uid),
      orderBy('fecha', 'desc')
    );

    // Suscribirse a cambios en tiempo real
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const transactionsData = [];
      querySnapshot.forEach((doc) => {
        transactionsData.push({ id: doc.id, ...doc.data() });
      });
      setTransactions(transactionsData);
      setLoading(false);
    }, (error) => {
      console.error('Error cargando transacciones:', error);
      setLoading(false);
    });

    // Limpiar suscripción al desmontar el componente
    return () => unsubscribe();
  }, [auth.currentUser, db, navigate]);

  // Formatear fecha
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Fecha no disponible';
    const date = timestamp.toDate();
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calcular totales
  const totalRecargas = transactions
    .filter(t => t.tipo === 'recarga')
    .reduce((sum, t) => sum + t.monto, 0);

  const totalPagos = transactions
    .filter(t => t.tipo === 'pago')
    .reduce((sum, t) => sum + t.monto, 0);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Cargando historial...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button 
          onClick={() => navigate('/dashboard')}
          style={styles.backButton}
        >
          ← Volver
        </button>
        <h2 style={styles.title}>Historial de Transacciones</h2>
      </div>

      {/* Resumen de totales */}
      <div style={styles.summaryContainer}>
        <div style={styles.summaryCard}>
          <h3 style={styles.summaryTitle}>Total Recargado</h3>
          <p style={styles.summaryAmount}>${totalRecargas.toFixed(2)}</p>
        </div>
        <div style={styles.summaryCard}>
          <h3 style={styles.summaryTitle}>Total Gastado</h3>
          <p style={styles.summaryAmount}>${totalPagos.toFixed(2)}</p>
        </div>
      </div>

      {/* Lista de transacciones */}
      <div style={styles.transactionsList}>
        {transactions.length === 0 ? (
          <div style={styles.emptyState}>
            {/* 👇 LÍNEA 119 - TEXTO MODIFICADO */}
            <p>Aún no has realizado transacciones</p>
            <button 
              onClick={() => navigate('/dashboard')}
              style={styles.primaryButton}
            >
              Hacer mi primera recarga
            </button>
          </div>
        ) : (
          transactions.map((transaction) => (
            <div key={transaction.id} style={styles.transactionCard}>
              <div style={styles.transactionHeader}>
                <span style={styles.transactionType}>
                  {transaction.tipo === 'recarga' ? '💰 Recarga' : '💳 Pago'}
                </span>
                <span style={{
                  ...styles.transactionAmount,
                  color: transaction.tipo === 'recarga' ? '#27ae60' : '#e74c3c'
                }}>
                  {transaction.tipo === 'recarga' ? '+' : '-'}${transaction.monto.toFixed(2)}
                </span>
              </div>
              <p style={styles.transactionDetail}>{transaction.detalle}</p>
              <div style={styles.transactionFooter}>
                <span style={styles.transactionDate}>
                  {formatDate(transaction.fecha)}
                </span>
                <span style={styles.transactionBalance}>
                  Saldo: ${transaction.saldo_resultante?.toFixed(2) || '0.00'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '20px',
    gap: '15px'
  },
  backButton: {
    padding: '10px 15px',
    backgroundColor: '#95a5a6',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer'
  },
  title: {
    color: '#2c3e50',
    margin: 0
  },
  loading: {
    textAlign: 'center',
    padding: '50px',
    fontSize: '18px',
    color: '#7f8c8d'
  },
  summaryContainer: {
    display: 'flex',
    gap: '15px',
    marginBottom: '25px',
    justifyContent: 'center'
  },
  summaryCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '10px',
    textAlign: 'center',
    minWidth: '150px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  summaryTitle: {
    margin: '0 0 10px 0',
    color: '#7f8c8d',
    fontSize: '14px'
  },
  summaryAmount: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#2c3e50'
  },
  transactionsList: {
    maxWidth: '600px',
    margin: '0 auto'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px',
    backgroundColor: 'white',
    borderRadius: '10px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  transactionCard: {
    backgroundColor: 'white',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '10px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  transactionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  transactionType: {
    fontWeight: 'bold',
    color: '#2c3e50'
  },
  transactionAmount: {
    fontWeight: 'bold',
    fontSize: '16px'
  },
  transactionDetail: {
    margin: '0 0 10px 0',
    color: '#7f8c8d'
  },
  transactionFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  transactionDate: {
    fontSize: '12px',
    color: '#95a5a6'
  },
  transactionBalance: {
    fontSize: '12px',
    color: '#3498db',
    fontWeight: 'bold'
  },
  primaryButton: {
    padding: '12px 20px',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    marginTop: '15px'
  }
};

export default TransactionHistory;