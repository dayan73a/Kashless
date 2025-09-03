// src/hooks/useBLEEnhanced.js
// Hook BLE completo para Kashless (Web Bluetooth + helpers de alto nivel)
// - Escaneo (picker nativo)
// - Conexión GATT
// - Escritura a characteristic (chunking 20 bytes)
// - Helpers: sendTime / sendCredits / sendStart / sendStop
// - Reconexión automática y limpieza segura

import { useEffect, useRef, useState } from "react";

// 🔧 PON AQUÍ TUS UUIDs (los que anuncia tu ESP32 como servidor GATT)
const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

// Tamaño típico seguro para BLE (muchos stacks limitan a ~20 bytes por write)
const MAX_CHUNK_LEN = 20;

export default function useBLEEnhanced() {
  // Estado público
  const [devices, setDevices] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState(null);

  // Detección soporte Web Bluetooth
  const isWeb = typeof navigator !== "undefined" && !!navigator.bluetooth;

  // Refs para mantener conexión viva entre renders
  const chosenDeviceRef = useRef(null);   // BluetoothDevice nativo elegido
  const gattRef = useRef(null);           // BluetoothRemoteGATTServer
  const serviceRef = useRef(null);        // BluetoothRemoteGATTService
  const writeCharRef = useRef(null);      // BluetoothRemoteGATTCharacteristic

  // ——————————————————————————
  // Utilidades privadas
  // ——————————————————————————
  const isFn = (f) => typeof f === "function";

  function log(...args) {
    // Cambia a console.debug si prefieres menos ruido
    console.log("[BLE]", ...args);
  }

  function handleDisconnected() {
    log("🧹 Disconnected");
    try {
      gattRef.current?.disconnect?.();
    } catch (_) {}
    gattRef.current = null;
    serviceRef.current = null;
    writeCharRef.current = null;
    setConnectedDevice(null);
  }

  async function prepareGatt(devLike) {
    // devLike puede ser el "entry" que guardamos o el BluetoothDevice nativo
    const native = devLike?.__native || devLike;
    if (!native) throw new Error("Device inválido");
    if (!native.gatt) throw new Error("El dispositivo no expone GATT");

    // 1) Conectar
    log("🔗 Conectando GATT…");
    const gatt = await native.gatt.connect();
    gattRef.current = gatt;

    // 2) Servicio y characteristic
    const service = await gatt.getPrimaryService(SERVICE_UUID);
    serviceRef.current = service;

    const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
    writeCharRef.current = characteristic;

    // 3) Evento de desconexión (limpiar antes de volver a añadir)
    try {
      native.removeEventListener?.("gattserverdisconnected", handleDisconnected);
    } catch (_) {}
    try {
      native.addEventListener?.("gattserverdisconnected", handleDisconnected);
    } catch (_) {}

    // 4) Guardar device activo
    chosenDeviceRef.current = native;
    setConnectedDevice({
      id: native.id,
      name: native.name || devLike?.name || "Dispositivo",
      gatt,
    });

    log("✅ GATT listo");
    return native;
  }

  async function ensureReady() {
    // Si ya tenemos characteristic y conexión viva → OK
    if (writeCharRef.current && gattRef.current?.connected) return;

    // Si se cayó, pero conocemos el device → reconectar
    const dev = chosenDeviceRef.current;
    if (!dev) throw new Error("No hay dispositivo conectado");
    await prepareGatt({ __native: dev, name: dev.name });
  }

  async function writeBuffer(buffer) {
    await ensureReady();
    const char = writeCharRef.current;
    if (!char) throw new Error("Characteristic no disponible");

    // Algunos stacks exigen fragmentar >20 bytes
    const total = buffer.byteLength;
    if (total <= MAX_CHUNK_LEN) {
      if (isFn(char.writeValueWithoutResponse)) {
        await char.writeValueWithoutResponse(buffer);
      } else {
        await char.writeValue(buffer);
      }
      return;
    }

    // Fragmentación en trozos de 20 bytes
    for (let i = 0; i < total; i += MAX_CHUNK_LEN) {
      const chunk = buffer.slice(i, i + MAX_CHUNK_LEN);
      if (isFn(char.writeValueWithoutResponse)) {
        await char.writeValueWithoutResponse(chunk);
      } else {
        await char.writeValue(chunk);
      }
      // Pequeño respiro entre trozos (algunos stacks lo agradecen)
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  // ——————————————————————————
  // API pública del hook
  // ——————————————————————————

  // ESCANEAR (picker nativo)
  async function scanForDevices() {
    if (!isWeb) {
      log("⚠️ Web Bluetooth no soportado en este navegador/dispositivo.");
      return;
    }
    try {
      setIsScanning(true);
      setDevices([]); // limpiar listado

      // Picker: el usuario elige el dispositivo
      const dev = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [SERVICE_UUID],
      });

      const entry = {
        id: dev.id,
        name: dev.name || "Dispositivo",
        deviceName: dev.name,
        gatt: dev.gatt,
        __native: dev,
      };
      setDevices([entry]);

      log("📡 Dispositivo elegido:", entry.name, entry.id);
      return entry;
    } catch (e) {
      // Usuario canceló o error
      log("🛑 Escaneo cancelado/error:", e?.message || e);
      return null;
    } finally {
      setIsScanning(false);
    }
  }

  // CONECTAR
  async function connectToDevice(devLike) {
    // Si venimos de escaneo en curso, lo damos por terminado
    if (isScanning) setIsScanning(false);

    const native = await prepareGatt(devLike);
    log("🔌 Conectado a", native.name || native.id);
    return native;
  }

  // ENVIAR TEXTO/COMANDO
  async function sendCommand(command) {
    const str = String(command ?? "");
    const encoder = new TextEncoder();
    const buf = encoder.encode(str);
    log("📤 Enviando comando:", str);
    await writeBuffer(buf);
    log("✅ Enviado");
  }

  // HELPERS DE ALTO NIVEL (compat con Payment)
  async function sendTime(minutes) {
    const m = Number(minutes);
    if (!Number.isFinite(m) || m <= 0) throw new Error("Minutos inválidos");
    // Ajusta el formato al que espera tu ESP32 (ej. "TIME:10")
    await sendCommand(`TIME:${m}`);
  }

  async function sendCredits(quarters) {
    const q = Number(quarters);
    if (!Number.isFinite(q) || q <= 0) throw new Error("Créditos inválidos");
    await sendCommand(`CREDITS:${q}`);
  }

  async function sendStart() {
    await sendCommand("START");
  }

  async function sendStop() {
    await sendCommand("STOP");
  }

  // DESCONECTAR MANUALMENTE
  function disconnect() {
    try {
      if (gattRef.current?.connected) {
        log("🔌 Desconectando…");
        gattRef.current.disconnect();
      }
    } catch (_) {}
    handleDisconnected();
  }

  // Limpieza al desmontar el componente que usa el hook
  useEffect(() => {
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    // Estado
    devices,
    connectedDevice,
    isScanning,
    isWeb,

    // Acciones
    scanForDevices,
    connectToDevice,
    sendCommand,
    sendTime,
    sendCredits,
    sendStart,
    sendStop,
    disconnect,
  };
}
