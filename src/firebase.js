// src/firebase.js - CONFIGURACIÓN COMPLETA CON STORAGE
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // 👈 IMPORT NUEVO

// Tu configuración de Firebase Web App
const firebaseConfig = {
  apiKey: "AIzaSyAvYql19kVdoDqxrXEF8GCNKjtaEYPhT8c",
  authDomain: "kashless-app.firebaseapp.com",
  projectId: "kashless-app",
  storageBucket: "kashless-app.firebasestorage.app", // 👈 Este bucket es para Storage
  messagingSenderId: "969768240544",
  appId: "1:969768240544:web:8929cb2903daa24bfa50c5",
  measurementId: "G-730BEZCRXG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// 👇 INICIALIZAR FIREBASE STORAGE - ¡ESTO FALTABA!
export const storage = getStorage(app);

export default app;