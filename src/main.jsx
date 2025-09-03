import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AppProvider } from './context/AppContext'
import { ensureSignedIn } from './firebase'

;(async () => {
  try {
    await ensureSignedIn(); // garantiza sesión (anónima si no hay)
  } catch (e) {
    console.error('No se pudo garantizar sesión:', e);
  } finally {
    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <AppProvider>
          <App />
        </AppProvider>
      </React.StrictMode>,
    )
  }
})();
