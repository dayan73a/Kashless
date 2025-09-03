import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { useApp } from '../context/AppContext.jsx';
import { useNavigate } from 'react-router-dom';

const BusinessDashboard = () => {
  const [view, setView] = useState('dashboard'); // 'dashboard' o 'create-business'
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [businessData, setBusinessData] = useState(null);
  const [financialSummary, setFinancialSummary] = useState({
    ventasHoy: 0,
    ventasSemana: 0,
    comisionesAcumuladas: 0,
    saldoDisponible: 0
  });
  
  const { currentUser, userLoading } = useApp();
  const navigate = useNavigate();

  // Verificar datos del usuario
  useEffect(() => {
    console.log('🔍 DEBUG - CurrentUser:', currentUser);
    console.log('🔍 DEBUG - Es dueño?:', currentUser?.es_dueno);
    
    if (currentUser && currentUser.es_dueno) {
      // Verificar si tiene negocio_id, si no, mostrar vista de creación
      if (!currentUser.negocio_id) {
        console.log('🔴 Usuario es dueño pero no tiene negocio asignado.');
        setView('create-business');
      } else {
        console.log('✅ Tiene negocio_id:', currentUser.negocio_id);
        setView('dashboard');
      }
    }
  }, [currentUser]);

  // Cargar datos del negocio y transacciones
  useEffect(() => {
    if (!currentUser || !currentUser.negocio_id) return;

    const loadBusinessData = async () => {
      try {
        console.log('📦 Cargando datos para negocio ID:', currentUser.negocio_id);
        
        // Cargar información del negocio
        const businessRef = doc(db, 'businesses', currentUser.negocio_id);
        const businessSnap = await getDoc(businessRef);
        
        if (businessSnap.exists()) {
          setBusinessData(businessSnap.data());
          console.log('✅ Negocio encontrado:', businessSnap.data());
        } else {
          console.log('❌ Negocio NO encontrado con ID:', currentUser.negocio_id);
        }

        // Consultar transacciones del negocio
        const q = query(
          collection(db, 'transactions'),
          where('negocio_id', '==', currentUser.negocio_id),
          orderBy('fecha', 'desc')
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
          console.log('📊 Transacciones encontradas:', querySnapshot.size);
          
          const transactionsData = [];
          let ventasHoy = 0;
          let ventasSemana = 0;
          let comisionesAcumuladas = 0;
          const hoy = new Date();
          const inicioSemana = new Date(hoy.setDate(hoy.getDate() - hoy.getDay()));

          querySnapshot.forEach((doc) => {
            const transaction = { id: doc.id, ...doc.data() };
            transactionsData.push(transaction);

            // Calcular métricas
            if (transaction.tipo === 'pago') {
              const transactionDate = transaction.fecha?.toDate();
              
              // Ventas hoy
              if (transactionDate && transactionDate.toDateString() === new Date().toDateString()) {
                ventasHoy += transaction.monto;
              }
              
              // Ventas esta semana
              if (transactionDate && transactionDate >= inicioSemana) {
                ventasSemana += transaction.monto;
              }
              
              // Comisiones (3%)
              comisionesAcumuladas += transaction.monto * 0.03;
            }
          });

          console.log('💰 Resumen financiero:', {
            ventasHoy,
            ventasSemana,
            comisionesAcumuladas,
            saldoDisponible: ventasSemana - comisionesAcumuladas
          });

          setTransactions(transactionsData);
          setFinancialSummary({
            ventasHoy,
            ventasSemana,
            comisionesAcumuladas,
            saldoDisponible: ventasSemana - comisionesAcumuladas
          });
          setLoading(false);
        }, (error) => {
          console.error('❌ Error en snapshot:', error);
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('❌ Error loading business data:', error);
        setLoading(false);
      }
    };

    loadBusinessData();
  }, [currentUser, navigate]);

  // Componente para crear negocio
  const CreateBusinessForm = () => {
    const [businessName, setBusinessName] = useState('');
    const [businessAddress, setBusinessAddress] = useState('');
    const [businessType, setBusinessType] = useState('lavanderia');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!businessName.trim() || !businessAddress.trim()) return;
      setIsLoading(true);

      try {
        // 1. Crear el documento del negocio en la colección 'businesses'
        const newBusinessRef = doc(collection(db, 'businesses'));
        await setDoc(newBusinessRef, {
          nombre: businessName,
          direccion: businessAddress,
          tipo: businessType,
          dueño_id: currentUser.uid,
          dueño_email: currentUser.email,
          comision_accumulada: 0,
          saldo_disponible: 0,
          activo: true
        });

        const newBusinessId = newBusinessRef.id;

        // 2. Actualizar el documento del usuario con el negocio_id
        const userDocRef = doc(db, 'users', currentUser.uid);
        await setDoc(userDocRef, { 
          negocio_id: newBusinessId 
        }, { merge: true });

        console.log("✅ Negocio creado y usuario actualizado con ID:", newBusinessId);
        alert('¡Negocio creado con éxito!');
        
        // Forzar recarga del usuario en el contexto
        window.location.reload();
        
      } catch (error) {
        console.error("Error creando negocio:", error);
        alert('Error al crear el negocio: ' + error.message);
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <div style={styles.createBusinessContainer}>
        <div style={styles.header}>
          <button 
            onClick={() => navigate('/dashboard')}
            style={styles.backButton}
          >
            ← Volver
          </button>
          <h2 style={styles.title}>Crear Tu Negocio</h2>
        </div>
        
        <div style={styles.formContainer}>
          <p style={styles.description}>Como socio, necesitas registrar tu negocio para comenzar a recibir pagos con Kashless.</p>
          
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Nombre del Negocio</label>
              <input
                type="text"
                placeholder="Ej: Lavandería Express"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                style={styles.input}
                required
              />
            </div>
            
            <div style={styles.inputGroup}>
              <label style={styles.label}>Dirección</label>
              <input
                type="text"
                placeholder="Ej: Av. Principal #123"
                value={businessAddress}
                onChange={(e) => setBusinessAddress(e.target.value)}
                style={styles.input}
                required
              />
            </div>
            
            <div style={styles.inputGroup}>
              <label style={styles.label}>Tipo de Negocio</label>
              <select 
                value={businessType} 
                onChange={(e) => setBusinessType(e.target.value)}
                style={styles.select}
              >
                <option value="lavanderia">Lavandería</option>
                <option value="cafeteria">Cafetería</option>
                <option value="restaurante">Restaurante</option>
                <option value="tienda">Tienda</option>
                <option value="otros">Otros</option>
              </select>
            </div>
            
            <button 
              type="submit" 
              disabled={isLoading}
              style={isLoading ? styles.submitButtonDisabled : styles.submitButton}
            >
              {isLoading ? 'Creando...' : 'Crear Negocio'}
            </button>
          </form>
        </div>
      </div>
    );
  };

  // Esperar a que el usuario se cargue
  if (userLoading || !currentUser) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Cargando usuario...</div>
      </div>
    );
  }

  // Verificar si es dueño
  if (!currentUser.es_dueno) {
    navigate('/dashboard');
    return null;
  }

  // Mostrar formulario de creación si no tiene negocio
  if (view === 'create-business') {
    return <CreateBusinessForm />;
  }

  // Mostrar dashboard del negocio
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button 
          onClick={() => navigate('/dashboard')}
          style={styles.backButton}
        >
          ← Volver
        </button>
        <h2 style={styles.title}>
          🏪 Panel de Mi Negocio
          {businessData?.nombre && ` - ${businessData.nombre}`}
        </h2>
      </div>

      {/* Resumen Financiero */}
      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <h3>💰 Ventas Hoy</h3>
          <p style={styles.amount}>${financialSummary.ventasHoy.toFixed(2)}</p>
        </div>
        <div style={styles.summaryCard}>
          <h3>📈 Ventas Semana</h3>
          <p style={styles.amount}>${financialSummary.ventasSemana.toFixed(2)}</p>
        </div>
        <div style={styles.summaryCard}>
          <h3>🏷️ Comisiones</h3>
          <p style={styles.amount}>${financialSummary.comisionesAcumuladas.toFixed(2)}</p>
        </div>
        <div style={styles.summaryCard}>
          <h3>💳 Saldo Disponible</h3>
          <p style={styles.amount}>${financialSummary.saldoDisponible.toFixed(2)}</p>
        </div>
      </div>

      {/* Sección de Transacciones */}
      <div style={styles.section}>
        <h3>📋 Últimas Transacciones ({transactions.length})</h3>
        {transactions.length === 0 ? (
          <p style={styles.empty}>No hay transacciones registradas</p>
        ) : (
          <div style={styles.transactionsList}>
            {transactions.slice(0, 10).map((transaction) => (
              <div key={transaction.id} style={styles.transactionCard}>
                <div style={styles.transactionHeader}>
                  <span>{transaction.fecha?.toDate().toLocaleDateString()}</span>
                  <span style={styles.amount}>
                    ${transaction.monto.toFixed(2)}
                  </span>
                </div>
                <p>{transaction.detalle}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Botones de Acción */}
      <div style={styles.buttonGroup}>
        <button style={styles.primaryButton}>
          📊 Ver Estadísticas Completas
        </button>
        <button style={styles.secondaryButton}>
          📤 Exportar Reporte
        </button>
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
  createBusinessContainer: {
    padding: '20px',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    marginBottom: '30px'
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
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px',
    marginBottom: '30px'
  },
  summaryCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '10px',
    textAlign: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  amount: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#27ae60',
    margin: '10px 0 0 0'
  },
  section: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '10px',
    marginBottom: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  empty: {
    textAlign: 'center',
    color: '#7f8c8d',
    fontStyle: 'italic'
  },
  transactionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  transactionCard: {
    padding: '15px',
    border: '1px solid #ecf0f1',
    borderRadius: '8px',
    backgroundColor: '#fafafa'
  },
  transactionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '5px'
  },
  buttonGroup: {
    display: 'flex',
    gap: '15px',
    justifyContent: 'center'
  },
  primaryButton: {
    padding: '15px 25px',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px'
  },
  secondaryButton: {
    padding: '15px 25px',
    backgroundColor: '#2ecc71',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px'
  },
  formContainer: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '10px',
    maxWidth: '500px',
    margin: '0 auto',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
  },
  description: {
    textAlign: 'center',
    color: '#7f8c8d',
    marginBottom: '25px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  label: {
    fontWeight: 'bold',
    color: '#2c3e50'
  },
  input: {
    padding: '12px 15px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    fontSize: '16px'
  },
  select: {
    padding: '12px 15px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    fontSize: '16px',
    backgroundColor: 'white'
  },
  submitButton: {
    padding: '15px',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold'
  },
  submitButtonDisabled: {
    padding: '15px',
    backgroundColor: '#bdc3c7',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'not-allowed',
    fontSize: '16px',
    fontWeight: 'bold'
  }
};

export default BusinessDashboard;