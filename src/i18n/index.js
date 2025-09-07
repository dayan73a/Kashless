// src/i18n/index.js
export const dict = {
  es: {
    common: {
      loading: "Cargando…",
      loadingUser: "Cargando usuario...",
      back: "← Volver",
    },

    // ➜ NUEVO: Dashboard / Balance / Recarga / Acciones
    dashboard: {
      title: "Panel",
    },
    balance: {
      title: "Saldo",
    },
    recharge: {
      title: "Recargar",
      other: "otro monto",
      processing: "Procesando…",
    },
    actions: {
      scan: "Escanear",
      history: "Historial",
      business: "Panel de negocio",
      stats: "Estadísticas",
      logout: "Cerrar sesión",
    },

    date: {
      today: "Hoy",
      week: "Semana",
      month: "Mes",
    },
    login: {
      subtitle: "Sistema de pagos para negocios",
      signin: "Iniciar Sesión",
      or: "o",
    },

    // Panel de negocio (ya lo tenías)
    biz: {
      title: "🏪 Panel de Mi Negocio",
      salesToday: "💰 Ventas Hoy",
      salesWeek: "📈 Ventas Semana",
      fees: "🏷️ Comisiones",
      availableBalance: "💳 Saldo Disponible",
      latestTx: "📋 Últimas Transacciones",
      noTx: "No hay transacciones registradas",
      viewFullStats: "📊 Ver Estadísticas Completas",
      exportReport: "📤 Exportar Reporte",
      exportWip: "Exportación en desarrollo",
    },

    // Etiquetas varias
    tx: {
      type: "Tipo",
      machine: "Máquina",
      user: "Usuario",
    },

    // ➜ NUEVO: tipos de transacción (lo usa TransactionHistory)
    types: {
      payment: "pago",
      recarga: "recarga",
      unknown: "desconocido",
    },

    // ➜ NUEVO: Historia (cabeceras/estados)
    history: {
      title: "Historial de transacciones",
      headers: {
        date: "Fecha",
        detail: "Detalle",
        amount: "Monto",
        status: "Estado",
      },
      empty: "No hay movimientos todavía",
      status: {
        pending: "Pendiente",
        success: "Completada",
        failed: "Fallida",
        unknown: "Desconocido",
      },
    },

    // ➜ NUEVO: helpers de detalle (funciones)
    detail: {
      topup: (amountStr) => `Recarga ${amountStr}`,
      payment_machine: (machine, minutes) =>
        minutes != null && minutes !== ""
          ? `Pago en ${machine} · ${minutes} min`
          : `Pago en ${machine}`,
    },

    stats: {
      title: "📊 Estadísticas completas",
      gross: "Ventas brutas",
      fees: "Comisiones",
      net: "Saldo neto",
      paymentsCount: "# Pagos",
      avgTicket: "Ticket promedio",
      topMachines: "Máquinas destacadas",
      noData: "Sin datos en este rango",
    },
    table: {
      machine: "Máquina",
      payments: "# Pagos",
      sales: "Ventas",
    },
  },

  en: {
    common: {
      loading: "Loading…",
      loadingUser: "Loading user...",
      back: "← Back",
    },

    // ➜ NEW: Dashboard / Balance / Recharge / Actions
    dashboard: {
      title: "Dashboard",
    },
    balance: {
      title: "Balance",
    },
    recharge: {
      title: "Top up",
      other: "other amount",
      processing: "Processing…",
    },
    actions: {
      scan: "Scan",
      history: "History",
      business: "Business panel",
      stats: "Statistics",
      logout: "Log out",
    },

    date: {
      today: "Today",
      week: "Week",
      month: "Month",
    },
    login: {
      subtitle: "Payments system for businesses",
      signin: "Sign in",
      or: "or",
    },

    biz: {
      title: "🏪 My Business Panel",
      salesToday: "💰 Sales Today",
      salesWeek: "📈 Sales This Week",
      fees: "🏷️ Fees",
      availableBalance: "💳 Available Balance",
      latestTx: "📋 Latest Transactions",
      noTx: "No transactions recorded",
      viewFullStats: "📊 View Full Statistics",
      exportReport: "📤 Export Report",
      exportWip: "Export coming soon",
    },

    tx: {
      type: "Type",
      machine: "Machine",
      user: "User",
    },

    // ➜ NEW: transaction types
    types: {
      payment: "payment",
      recarga: "top-up",
      unknown: "unknown",
    },

    // ➜ NEW: history strings
    history: {
      title: "Transaction history",
      headers: {
        date: "Date",
        detail: "Detail",
        amount: "Amount",
        status: "Status",
      },
      empty: "No activity yet",
      status: {
        pending: "Pending",
        success: "Completed",
        failed: "Failed",
        unknown: "Unknown",
      },
    },

    // ➜ NEW: detail helpers (functions)
    detail: {
      topup: (amountStr) => `Top-up ${amountStr}`,
      payment_machine: (machine, minutes) =>
        minutes != null && minutes !== ""
          ? `Payment at ${machine} · ${minutes} min`
          : `Payment at ${machine}`,
    },

    stats: {
      title: "📊 Full statistics",
      gross: "Gross sales",
      fees: "Fees",
      net: "Net balance",
      paymentsCount: "# Payments",
      avgTicket: "Avg ticket",
      topMachines: "Top machines",
      noData: "No data in this range",
    },
    table: {
      machine: "Machine",
      payments: "# Payments",
      sales: "Sales",
    },
  },
};

export default dict;
