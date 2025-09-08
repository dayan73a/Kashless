// src/context/AppContext.jsx
import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { auth, db } from '../firebase'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { doc, onSnapshot, getDoc } from 'firebase/firestore'

const AppContext = createContext(null)

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp debe usarse dentro de un AppProvider')
  return ctx
}

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [appConfig, setAppConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const triedAnonRef = useRef(false)
  const unsubUserDocRef = useRef(null)

  // Config global (no bloquea loading)
  const loadAppConfig = async () => {
    try {
      const snap = await getDoc(doc(db, 'app_config', 'main'))
      if (snap.exists()) setAppConfig(snap.data())
    } catch (e) {
      console.warn('Error cargando configuración:', e)
    }
  }

  useEffect(() => {
    loadAppConfig()

    // Observa sesión
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      // Limpia suscripción previa al doc del usuario
      if (unsubUserDocRef.current) {
        unsubUserDocRef.current()
        unsubUserDocRef.current = null
      }

      if (u) {
        setUser(u)
        // Suscribe a users/{uid}
        const ref = doc(db, 'users', u.uid)
        unsubUserDocRef.current = onSnapshot(
          ref,
          (docSnap) => {
            setUserData(docSnap.exists() ? docSnap.data() : null)
            setLoading(false)
          },
          (err) => {
            console.warn('onSnapshot user error:', err)
            setUserData(null)
            setLoading(false)
          }
        )
        return
      }

      // No hay usuario: intenta anónimo UNA vez
      setUser(null)
      setUserData(null)
      if (!triedAnonRef.current) {
        triedAnonRef.current = true
        try {
          await signInAnonymously(auth)
          // onAuthStateChanged volverá a disparar y cerrará loading
        } catch (e) {
          console.warn('Anon sign-in failed:', e)
          setLoading(false) // no bloquees la UI si falla
        }
      } else {
        // Ya intentamos antes → no bloquees
        setLoading(false)
      }
    })

    return () => {
      unsubAuth()
      if (unsubUserDocRef.current) {
        unsubUserDocRef.current()
        unsubUserDocRef.current = null
      }
    }
  }, [])

  const currentUser = user
    ? { uid: user.uid, email: user.email ?? null, ...userData }
    : null

  const value = {
    user,
    userData,
    appConfig,
    currentUser,
    saldo: userData?.saldo_general || 0,
    loading,
    refreshAppConfig: loadAppConfig,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
