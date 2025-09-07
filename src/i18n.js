// src/i18n.js
export const dict = {
  es: {
    dashboard: { title: "Mi Cuenta Kashless" },
    balance: { title: "Mi Saldo" },
    recharge: { title: "Recargar Saldo", other: "Otro monto", processing: "Procesando…" },
    actions: {
      scan: "📷 Escáner QR",
      history: "📋 Historial de Transacciones",
      business: "🏪 Mi Panel de Negocio",
      stats: "📊 Estadísticas",
      logout: "🚪 Cerrar Sesión",
      back: "← Volver",
    },
    login: {
      title: "Bienvenido a Kashless",
      subtitle: "Paga tus máquinas sin monedas",
      google: "Continuar con Google",
      anonymous: "Entrar como invitado",
      or: "o",
    },
    history: {
      title: "Historial de Transacciones",
      empty: "No hay transacciones todavía",
      headers: { date: "Fecha", detail: "Detalle", amount: "Monto", status: "Estado" },
      status: { active: "Activa", completed: "Completada", failed: "Fallida", unknown: "Desconocido" },
    },
    types: { payment: "Pago", recarga: "Recarga", unknown: "Transacción" },
    detail: {
      topup: (amount) => `Recarga de saldo ${amount}`,
      payment_machine: (machine, minutes) =>
        minutes ? `Pago a ${machine} (${minutes} min)` : `Pago a ${machine}`,
    },
    stats: {
      user: { title: "📊 Tus estadísticas" },
      payments: { today: "Pagos Hoy", week: "Pagos Semana", _30: "Pagos 30 días", avg30: "Ticket Prom. 30 días" },
      note: { user: "* Calculado con tus últimas transacciones visibles (hasta 200 por consulta)." },
    },
    language: { choose: "Elige tu idioma", es: "Español", en: "English" },
  },

  en: {
    dashboard: { title: "My Kashless Account" },
    balance: { title: "My Balance" },
    recharge: { title: "Top up", other: "Custom amount", processing: "Processing…" },
    actions: {
      scan: "📷 QR Scanner",
      history: "📋 Transaction History",
      business: "🏪 My Business Panel",
      stats: "📊 Stats",
      logout: "🚪 Log out",
      back: "← Back",
    },
    login: {
      title: "Welcome to Kashless",
      subtitle: "Pay machines without coins",
      google: "Continue with Google",
      anonymous: "Continue as guest",
      or: "or",
    },
    history: {
      title: "Transaction History",
      empty: "No transactions yet",
      headers: { date: "Date", detail: "Detail", amount: "Amount", status: "Status" },
      status: { active: "Active", completed: "Completed", failed: "Failed", unknown: "Unknown" },
    },
    types: { payment: "Payment", recarga: "Top-up", unknown: "Transaction" },
    detail: {
      topup: (amount) => `Top-up ${amount}`,
      payment_machine: (machine, minutes) =>
        minutes ? `Payment to ${machine} (${minutes} min)` : `Payment to ${machine}`,
    },
    stats: {
      user: { title: "📊 Your stats" },
      payments: { today: "Payments Today", week: "Payments This Week", _30: "Payments (30 days)", avg30: "Avg Ticket (30 days)" },
      note: { user: "* Calculated from your latest visible transactions (up to 200 per query)." },
    },
    language: { choose: "Choose your language", es: "Español", en: "English" },
  },
};
