// src/firebase.ts
import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signInAnonymously,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Configuración real de tu proyecto
const firebaseConfig = {
  apiKey: "AIzaSyAvYql19kVdoDqxrXEF8GCNKjtaEYPhT8c",
  authDomain: "kashless-app.firebaseapp.com",
  projectId: "kashless-app",
  storageBucket: "kashless-app.appspot.com", // 👈 ok
  messagingSenderId: "969768240544",
  appId: "1:969768240544:web:8929cb2903daa24bfa50c5",
  measurementId: "G-730BEZCRXG",
};

// Inicializa Firebase
export const app = initializeApp(firebaseConfig);

// Servicios principales
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Persistencia de sesión
setPersistence(auth, browserLocalPersistence);

// Garantiza que siempre haya usuario (anónimo si no inicia sesión)
export async function ensureSignedIn(): Promise<void> {
  if (auth.currentUser) return;
  await new Promise<void>((resolve) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        await signInAnonymously(auth);
      }
      unsub();
      resolve();
    });
  });
}

// Obtén un token JWT válido
export async function getAuthToken(forceRefresh = false): Promise<string> {
  await ensureSignedIn();
  const user = auth.currentUser!;
  return user.getIdToken(forceRefresh);
}

// Arranca sesión anónima al cargar (no bloqueante)
ensureSignedIn().catch((e) => console.error("ensureSignedIn error:", e));

// Export default (para importaciones por defecto)
export default app;
