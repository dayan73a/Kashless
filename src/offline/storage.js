// src/offline/storage.js
// Cola offline súper simple basada en localStorage

const KEY = "offline_transactions_v1";

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch (e) {
    console.error("[offline] No se pudo escribir localStorage:", e);
  }
}

/**
 * Guarda una transacción pendiente.
 * @param {object} tx - { userId, machineId, amount, amountCents, minutes, ... }
 */
export function saveOfflineTx(tx) {
  const list = readAll();

  // Pequeña protección contra duplicados exactos (mismo payload en 10s)
  const now = Date.now();
  const dup = list.find(
    (t) =>
      t.userId === tx.userId &&
      t.machineId === tx.machineId &&
      t.amountCents === tx.amountCents &&
      Math.abs((t.savedAt || 0) - now) < 10_000
  );
  if (dup) return;

  list.push({ ...tx, savedAt: now, _v: 1 });
  writeAll(list);
}

/** Devuelve la lista completa de pendientes */
export function getOfflineTxs() {
  return readAll();
}

/** Reemplaza toda la lista (útil tras sincronizar parcialmente) */
export function setOfflineTxs(list) {
  writeAll(Array.isArray(list) ? list : []);
}

/** Limpia todas las pendientes */
export function clearOfflineTxs() {
  writeAll([]);
}
