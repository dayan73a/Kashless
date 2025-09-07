// src/lib/wallet.js
import {
  doc,
  getDoc,
  setDoc,
  runTransaction,
  serverTimestamp,
  collection,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Asegura que exista el documento de usuario con el campo balanceCents.
 */
export async function ensureWalletDoc(uid) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(
      userRef,
      {
        balanceCents: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } else if (typeof snap.data()?.balanceCents !== "number") {
    await setDoc(
      userRef,
      {
        balanceCents: 0,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
  return userRef;
}

/**
 * Devuelve el saldo en centavos.
 */
export async function getWalletBalance(uid) {
  const userRef = await ensureWalletDoc(uid);
  const snap = await getDoc(userRef);
  return snap.data()?.balanceCents ?? 0;
}

/**
 * Suma saldo a la billetera del usuario (centavos).
 * Devuelve el nuevo balance.
 */
export async function creditWallet(uid, amountCents, metadata = {}) {
  if (!uid) throw new Error("Falta uid");
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error("Monto de recarga inválido");
  }

  const userRef = doc(db, "users", uid);
  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    const current = snap.exists() ? snap.data().balanceCents || 0 : 0;
    const next = current + amountCents;

    tx.set(
      userRef,
      { balanceCents: next, updatedAt: serverTimestamp() },
      { merge: true }
    );

    // Ledger (opcional, útil para auditoría)
    const ledgerRef = doc(collection(db, "users", uid, "wallet_ledger"));
    tx.set(ledgerRef, {
      type: "credit",
      amountCents,
      balanceAfterCents: next,
      metadata,
      createdAt: serverTimestamp(),
    });

    return next;
  });
}

/**
 * Debita saldo (centavos). Lanza error si no hay fondos.
 * Devuelve { newBalanceCents, ledgerId }.
 */
export async function debitWallet(uid, amountCents, metadata = {}) {
  if (!uid) throw new Error("Falta uid");
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error("Monto de débito inválido");
  }

  const userRef = doc(db, "users", uid);
  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    const current = snap.exists() ? snap.data().balanceCents || 0 : 0;

    if (current < amountCents) {
      throw new Error("Saldo insuficiente");
    }

    const next = current - amountCents;

    tx.set(
      userRef,
      { balanceCents: next, updatedAt: serverTimestamp() },
      { merge: true }
    );

    // Ledger (opcional)
    const ledgerRef = doc(collection(db, "users", uid, "wallet_ledger"));
    tx.set(ledgerRef, {
      type: "debit",
      amountCents,
      balanceAfterCents: next,
      metadata,
      createdAt: serverTimestamp(),
    });

    return { newBalanceCents: next, ledgerId: ledgerRef.id };
  });
}