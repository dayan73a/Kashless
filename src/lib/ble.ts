// src/lib/ble.ts
// Kashless - BLE nativo universal (iOS + Android) con Capacitor
// Requiere: @capacitor/core, @capacitor-community/bluetooth-le
// Uso:  import { activateMachine } from '../lib/ble';  await activateMachine(100);

import { Capacitor } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';

export const BLE_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
export const BLE_CHAR_UUID    = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
export const DEVICE_NAME      = 'Kashless_Machine_01';

// Permitir fallback Web Bluetooth (Android/Chrome). iOS Safari no soporta.
const ENABLE_WEB_BLUETOOTH_FALLBACK = true;

let _bleInited = false;
async function ensureBleReady() {
  if (_bleInited) return;
  await BleClient.initialize({ androidNeverForLocation: true });
  _bleInited = true;
}

// Construye payload en tres formatos: bytes, ArrayBuffer y DataView
function buildPayload(cents: number): {
  text: string;
  bytes: Uint8Array;
  buffer: ArrayBuffer;
  view: DataView;
} {
  if (!Number.isFinite(cents) || cents <= 0) throw new Error('Monto inválido');
  const text = `CENTS:${Math.floor(cents)}`;
  const bytes = new TextEncoder().encode(text);
  // Clonar a ArrayBuffer "puro" (no SharedArrayBuffer) y crear DataView
  const buffer = bytes.buffer.slice(0);
  const view = new DataView(buffer);
  return { text, bytes, buffer, view };
}

function normalizeError(e: unknown): Error {
  const msg = (e as any)?.message || String(e);
  if (msg.includes('NotAllowedError') || msg.includes('User cancelled')) {
    return new Error('Operación cancelada por el usuario.');
  }
  if (msg.includes('NotFoundError') || msg.includes('No devices found')) {
    return new Error('No se encontró la máquina por BLE.');
  }
  if (msg.includes('NotSupportedError')) {
    return new Error('BLE no soportado en este entorno.');
  }
  if (msg.includes('GATT') || msg.includes('connect')) {
    return new Error('No se pudo conectar por BLE.');
  }
  return new Error(msg);
}

/** Activa la máquina enviando CENTS:x por BLE (llamar desde onClick). */
export async function activateMachine(cents: number): Promise<void> {
  const { buffer, view } = buildPayload(cents);

  // 1) App nativa (iOS/Android) – definitivo y offline
  if (Capacitor.isNativePlatform()) {
    try {
      await ensureBleReady();

      const device = await BleClient.requestDevice({
        name: DEVICE_NAME,
        services: [BLE_SERVICE_UUID],
      });

      await BleClient.connect(device.deviceId);

      // ▶ Plugin BLE (nativo) espera DataView
      await BleClient.write(device.deviceId, BLE_SERVICE_UUID, BLE_CHAR_UUID, view);

      await delay(120); // asegurar TX
      await BleClient.disconnect(device.deviceId);
      return;
    } catch (e) {
      throw normalizeError(e);
    }
  }

  // 2) Fallback Web Bluetooth (solo Android/Chrome)
  if (ENABLE_WEB_BLUETOOTH_FALLBACK && (navigator as any)?.bluetooth) {
    try {
      const dev: BluetoothDevice = await (navigator as any).bluetooth.requestDevice({
        filters: [{ name: DEVICE_NAME }],
        optionalServices: [BLE_SERVICE_UUID],
      });

      const gatt = await dev.gatt!.connect();
      const service = await gatt.getPrimaryService(BLE_SERVICE_UUID as BluetoothServiceUUID);
      const char = await service.getCharacteristic(BLE_CHAR_UUID as BluetoothCharacteristicUUID);

      // ▶ Web Bluetooth acepta BufferSource; usamos ArrayBuffer
      await char.writeValue(buffer);

      try { await gatt.disconnect(); } catch {}
      return;
    } catch (e) {
      throw normalizeError(e);
    }
  }

  // 3) Sin nativo ni Web BLE compatible
  throw new Error('Instala la app Kashless para activar la máquina por Bluetooth.');
}

function delay(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}
