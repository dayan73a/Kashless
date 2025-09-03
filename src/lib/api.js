// src/lib/api.js
import { getAuthToken } from '../firebase';

export async function apiFetch(url, options = {}) {
  // Obtiene el token de Firebase (si no hay usuario, crea uno anónimo)
  const token = await getAuthToken();

  // Prepara headers
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  // Llama al backend
  const res = await fetch(url, { ...options, headers });

  // Si el token expira (401), refresca y reintenta
  if (res.status === 401) {
    const fresh = await getAuthToken(true);
    headers.set('Authorization', `Bearer ${fresh}`);
    const retry = await fetch(url, { ...options, headers });
    if (!retry.ok) throw new Error(`HTTP ${retry.status}: ${await retry.text()}`);
    return retry;
  }

  // Si hubo otro error, lánzalo
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res;
}
