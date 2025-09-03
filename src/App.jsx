import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import React from 'react';
// Importa el hook personalizado del contexto
import { useApp } from './context/AppContext';
import Login from './components/Login';


// Componentes lazy
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const QrScanner = React.lazy(() => import('./components/QrScanner'));
const Payment = React.lazy(() => import('./components/Payment'));
const Confirmacion = React.lazy(() => import('./components/Confirmacion'));
const TransactionHistory = React.lazy(() => import('./components/TransactionHistory'));
// 👇 AGREGAR IMPORT DEL BUSINESS DASHBOARD
const BusinessDashboard = React.lazy(() => import('./components/BusinessDashboard'));

function App() {
  // Usa el contexto en lugar del estado local
  const { user, loading } = useApp();

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={user ? <Navigate to="/dashboard" /> : <Login />} 
        />
        <Route 
          path="/dashboard" 
          element={user ? 
            <React.Suspense fallback={<div>Cargando dashboard...</div>}>
              <Dashboard />
            </React.Suspense> 
            : <Navigate to="/" />} 
        />
        <Route 
          path="/scanner" 
          element={user ? 
            <React.Suspense fallback={<div>Cargando scanner...</div>}>
              <QrScanner />
            </React.Suspense> 
            : <Navigate to="/" />} 
        />
        <Route 
          path="/payment" 
          element={user ? 
            <React.Suspense fallback={<div>Cargando pago...</div>}>
              <Payment />
            </React.Suspense> 
            : <Navigate to="/" />} 
        />
        <Route 
          path="/confirmacion" 
          element={user ? 
            <React.Suspense fallback={<div>Cargando confirmación...</div>}>
              <Confirmacion />
            </React.Suspense> 
            : <Navigate to="/" />} 
        />
        <Route 
          path="/history" 
          element={user ? 
            <React.Suspense fallback={<div>Cargando historial...</div>}>
              <TransactionHistory />
            </React.Suspense> 
            : <Navigate to="/" />} 
        />
        {/* 👇 NUEVA RUTA PARA EL PANEL DE NEGOCIO */}
        <Route 
          path="/business-dashboard" 
          element={user ? 
            <React.Suspense fallback={<div>Cargando panel de negocio...</div>}>
              <BusinessDashboard />
            </React.Suspense> 
            : <Navigate to="/" />} 
        />
      </Routes>
    </Router>
  );
}

export default App;