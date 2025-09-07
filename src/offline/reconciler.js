// src/offline/reconciler.js
import { db } from "../firebase";
import { addDoc, collection, serverTimestamp, setDoc, doc } from "firebase/firestore";
import { getOfflineTxs, setOfflineTxs, clearOfflineTxs } from "./storage";

/**
 * Sube todas las transacciones pendientes a Firestore.
 * - Si alguna falla, se detiene y deja el resto para más tarde.
 * - Si sube una transacción que tiene machineId/endTime, intenta reflejar estado en /machines/{id}.
 */
export async function syncOfflineTxs() {
  const list = getOfflineTxs();
  if (!list || list.length === 0) return;

  const remaining = [];

  for (const tx of list) {
    try {
      // Crear transacción online
      const ref = await addDoc(collection(db, "transactions"), {
        ...tx,
        // startTime como serverTimestamp para consistencia
        startTime: serverTimestamp(),
        syncedAt: serverTimestamp(),
        _source: "offline-replayed"
      });

      // Intento opcional de reflejar estado en la máquina
      if (tx.machineId && tx.endTime) {
        try {
          await setDoc(
            doc(db, "machines", tx.machineId),
            {
              status: "in-use",
              currentUser: tx.userId,
              endTime: tx.endTime,
              lastTransaction: ref.id,
              updatedAt: serverTimestamp()
            },
            { merge: true }
          );
        } catch (e) {
          // No crítico: el registro principal ya se guardó
          console.warn("[offline] No se pudo actualizar machines/", tx.machineId, e);
        }
      }
    } catch (e) {
      console.warn("[offline] Error al sincronizar una tx, se reintenta luego:", e);
      // dejamos esta y las siguientes para más tarde
      remaining.push(tx);
      // IMPORTANTE: cortamos el ciclo para no bombardear si hay un problema de red puntual
      break;
    }
  }

  if (remaining.length === 0) {
    clearOfflineTxs();
  } else {
    setOfflineTxs(remaining);
  }
}
