// src/firebase.ts
import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  onAuthStateChanged,
  signInAnonymously,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ⚙️ Config real (tuya)
const firebaseConfig = {
  apiKey: "AIzaSyAvYql19kVdoDqxrXEF8GCNKjtaEYPhT8c",
  authDomain: "kashless-app.firebaseapp.com",
  projectId: "kashless-app",
  storageBucket: "kashless-app.appspot.com",
  messagingSenderId: "969768240544",
  appId: "1:969768240544:web:8929cb2903daa24bfa50c5",
  measurementId: "G-730BEZCRXG",
};

// 🔐 Init segura
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// 🔒 Persistencia con fallback (no rompas en iOS WebView)
(async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (e1) {
    console.warn("Local persistence failed, falling back to session:", e1);
    try {
      await setPersistence(auth, browserSessionPersistence);
    } catch (e2) {
      console.warn("Session persistence failed, using in-memory:", e2);
      await setPersistence(auth, inMemoryPersistence);
    }
  }
})().catch(() => { /* no-op */ });

// ✅ Garantiza usuario (anónimo si no hay), tolerante a errores
export async function ensureSignedIn(): Promise<void> {
  try {
    if (auth.currentUser) return;
    await new Promise<void>((resolve) => {
      const unsub = onAuthStateChanged(auth, async (user) => {
        try {
          if (!user) {
            await signInAnonymously(auth);
          }
        } finally {
          unsub();
          resolve();
        }
      });
    });
  } catch (e) {
    console.warn("ensureSignedIn skipped:", e);
  }
}

// 🔑 Token JWT
export async function getAuthToken(forceRefresh = false): Promise<string> {
  await ensureSignedIn();
  const user = auth.currentUser!;
  return user.getIdToken(forceRefresh);
}

export default app;
