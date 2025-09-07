const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { onCall } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');

initializeApp();
const db = getFirestore();

/** Utils */
const dayKeyUTC = (d = new Date()) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
};
const weekKeyUTC = (d = new Date()) => {
  // ISO week
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
  return `${dt.getUTCFullYear()}-${String(weekNo).padStart(2, '0')}`;
};

const getCommissionPct = (biz) => {
  if (!biz) return 0.03;
  if (typeof biz.commission_pct === 'number') return biz.commission_pct;
  if (typeof biz.comision_pct === 'number') return biz.comision_pct;
  return 0.03;
};

async function ensureMachineToBusiness(machineId, fallbackUserId) {
  if (!machineId) return null;
  const ref = db.collection('machines').doc(machineId);
  const snap = await ref.get();
  if (snap.exists && snap.data()?.business_id) return snap.data().business_id;

  // intento por usuario -> users/{uid}.negocio_id
  if (fallbackUserId) {
    const u = await db.collection('users').doc(fallbackUserId).get();
    if (u.exists && (u.data().negocio_id || u.data().business_id)) {
      return u.data().negocio_id || u.data().business_id;
    }
  }
  return null;
}

async function writeTransactionAndStats({ businessId, type, amount_cents, sign, machine_id, user_id, originDocPath }) {
  if (!businessId || !amount_cents || !type) throw new Error('Missing required fields');

  // 1) Crear transacción normalizada
  const txRef = db.collection('transactions').doc(); // id nuevo
  await txRef.set({
    business_id: businessId,
    type,
    amount_cents: Math.abs(amount_cents),
    sign: sign || (type === 'payment' ? '-' : '+'),
    created_at: FieldValue.serverTimestamp(),
    machine_id: machine_id || null,
    user_id: user_id || null,
    origin: originDocPath || null
  });

  // 2) Stats y saldo
  const bizRef = db.collection('businesses').doc(businessId);
  const bizSnap = await bizRef.get();
  const biz = bizSnap.exists ? bizSnap.data() : null;
  const commissionPct = getCommissionPct(biz);

  const isPayment = type === 'payment';
  const isTopup = type === 'topup' || type === 'recarga';

  const gross = Math.abs(amount_cents);
  const commission = isPayment ? Math.round(gross * commissionPct) : 0;
  const net = isPayment ? (gross - commission) : 0;

  const dKey = dayKeyUTC();
  const wKey = weekKeyUTC();

  const dailyRef = db.collection('business_stats').doc(businessId).collection('daily').doc(dKey);
  const weeklyRef = db.collection('business_stats').doc(businessId).collection('weekly').doc(wKey);

  const updatesDaily = {
    last_update: FieldValue.serverTimestamp(),
    sales_cents: FieldValue.increment(isPayment ? gross : 0),
    topups_cents: FieldValue.increment(isTopup ? gross : 0),
    commissions_cents: FieldValue.increment(isPayment ? commission : 0),
  };
  const updatesWeekly = {
    last_update: FieldValue.serverTimestamp(),
    sales_cents: FieldValue.increment(isPayment ? gross : 0),
    topups_cents: FieldValue.increment(isTopup ? gross : 0),
    commissions_cents: FieldValue.increment(isPayment ? commission : 0),
  };

  await Promise.all([
    dailyRef.set(updatesDaily, { merge: true }),
    weeklyRef.set(updatesWeekly, { merge: true }),
    bizRef.set({
      available_balance_cents: FieldValue.increment(net)
    }, { merge: true })
  ]);

  return { ok: true };
}

/**
 * Trigger 1: Normaliza cualquier documento creado en una colección (o subcolección)
 * llamada 'payments' -> crea transacción y actualiza stats/saldo.
 */
exports.onPaymentCreated = onDocumentCreated('payments/{paymentId}', async (event) => {
  const data = event.data?.data();
  if (!data) return;

  // Detecta businessId
  let businessId = data.business_id || data.negocio_id || null;
  if (!businessId) {
    businessId = await ensureMachineToBusiness(data.machine_id || data.machineId, data.user_id || data.userId);
  }
  if (!businessId) {
    console.warn('Payment without business_id and no machine mapping. Skipping.', event.params?.paymentId);
    return;
  }

  // Monto
  const amount_cents =
    data.paidWithWalletCents ??
    data.amount_cents ??
    data.amountCents ??
    (typeof data.monto === 'number' ? Math.round(data.monto * 100) : 0);

  if (!amount_cents || amount_cents <= 0) {
    console.warn('Payment with invalid amount:', amount_cents);
    return;
  }

  await writeTransactionAndStats({
    businessId,
    type: 'payment',
    amount_cents,
    sign: '-',
    machine_id: data.machine_id || data.machineId || null,
    user_id: data.user_id || data.userId || null,
    originDocPath: event.data?.ref?.path || null
  });
});

/**
 * Trigger 2: Si tus docs se llaman 'machine_payments' en vez de 'payments'
 */
exports.onMachinePaymentCreated = onDocumentCreated('machine_payments/{paymentId}', async (event) => {
  const data = event.data?.data();
  if (!data) return;

  let businessId = data.business_id || data.negocio_id || null;
  if (!businessId) {
    businessId = await ensureMachineToBusiness(data.machine_id || data.machineId, data.user_id || data.userId);
  }
  if (!businessId) return;

  const amount_cents =
    data.paidWithWalletCents ??
    data.amount_cents ??
    data.amountCents ??
    (typeof data.monto === 'number' ? Math.round(data.monto * 100) : 0);

  if (!amount_cents || amount_cents <= 0) return;

  await writeTransactionAndStats({
    businessId,
    type: 'payment',
    amount_cents,
    sign: '-',
    machine_id: data.machine_id || data.machineId || null,
    user_id: data.user_id || data.userId || null,
    originDocPath: event.data?.ref?.path || null
  });
});

/**
 * Callable opcional para pagos/recargas desde la UI:
 * createTransaction({ businessId, type: 'payment'|'topup', amountCents, machineId, userId })
 */
exports.createTransaction = onCall(async (req) => {
  const data = req.data || {};
  const businessId = data.businessId || data.negocio_id || data.business_id;
  const type = data.type; // 'payment' | 'topup'
  const amount_cents = Number(data.amountCents || data.amount_cents || 0);
  const machine_id = data.machineId || data.machine_id || null;
  const user_id = req.auth?.uid || data.userId || data.user_id || null;

  if (!businessId || !type || !amount_cents) {
    return { ok: false, message: 'Missing fields (businessId, type, amountCents)' };
  }
  await writeTransactionAndStats({
    businessId,
    type: type === 'topup' ? 'topup' : 'payment',
    amount_cents,
    sign: type === 'topup' ? '+' : '-',
    machine_id,
    user_id,
    originDocPath: null
  });
  return { ok: true };
});

// Ping
exports.helloWorld = onRequest((_req, res) => {
  res.status(200).send('Kashless Functions OK');
});
