import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// Crear el contexto
const AppContext = createContext();

// Hook personalizado para usar el contexto
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp debe usarse dentro de un AppProvider');
  }
  return context;
};

// Proveedor del contexto
export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [appConfig, setAppConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  // 👇 Función para cargar la configuración global
  const loadAppConfig = async () => {
    try {
      const docRef = doc(db, 'app_config', 'main');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setAppConfig(docSnap.data());
      } else {
        console.log("No se encontró configuración global");
      }
    } catch (error) {
      console.error("Error cargando configuración:", error);
    }
  };

  useEffect(() => {
    // Cargar configuración global al iniciar
    loadAppConfig();

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      
      if (user) {
        // Suscribirse a los datos del usuario en Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribeFirestore = onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) {
            setUserData(doc.data());
          } else {
            setUserData(null);
          }
          setLoading(false);
        });

        return () => unsubscribeFirestore();
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // 👇 CREAR currentUser COMBINADO
  const currentUser = user ? {
    uid: user.uid,
    email: user.email,
    ...userData  // Combina todos los campos de Firestore
  } : null;

  const value = {
    user,
    userData,
    appConfig,
    loading,
    saldo: userData?.saldo_general || 0,
    refreshAppConfig: loadAppConfig,
    // 👇 AGREGAR USUARIO COMBINADO
    currentUser  // ¡Este es el campo nuevo!
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};