// src/App.jsx
import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';

import { useApp } from './context/AppContext.jsx';
import { I18nProvider, useI18n } from './context/I18nContext.jsx';
import LanguageGate from './components/LanguageGate.jsx';
import LanguageSwitcher from './components/LanguageSwitcher.jsx';

import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';
import QrScanner from './components/QrScanner.jsx';
import Payment from './components/Payment.jsx';
import Confirmacion from './components/Confirmacion.jsx';
import TransactionHistory from './components/TransactionHistory.jsx';
import BusinessDashboard from './components/BusinessDashboard.jsx';
import BusinessSettings from './components/BusinessSettings.jsx';

function RequireLanguage({ children }) {
  const { ready } = useI18n();
  const location = useLocation();
  if (!ready && location.pathname !== '/language') {
    return <Navigate to="/language" replace />;
  }
  return children;
}

function AppRoutes() {
  const { user, loading } = useApp();
  const { lang } = useI18n();

  if (loading) return <div>Cargando...</div>;

  return (
    <Routes>
      <Route path="/language" element={<LanguageGate />} />
      <Route
        path="/*"
        element={
          <RequireLanguage>
            <Routes>
              <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Login />} />
              <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/" />} />
              <Route path="/scanner" element={user ? <QrScanner /> : <Navigate to="/" />} />
              <Route path="/payment" element={user ? <Payment /> : <Navigate to="/" />} />
              <Route path="/confirmacion" element={user ? <Confirmacion /> : <Navigate to="/" />} />
              <Route path="/history" element={user ? <TransactionHistory /> : <Navigate to="/" />} />
              <Route
                path="/business-dashboard"
                element={user ? <BusinessDashboard key={`biz-${lang}`} /> : <Navigate to="/" />}
              />
              <Route
                path="/business-settings"
                element={user ? <BusinessSettings key={`bizset-${lang}`} /> : <Navigate to="/" />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </RequireLanguage>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <Router>
        <LanguageSwitcher />
        <AppRoutes />
      </Router>
    </I18nProvider>
  );
}
