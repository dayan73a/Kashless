// src/hooks/useQrScanner.js
import { useState } from 'react';

export const useQrScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');

  const startScanning = async () => {
    try {
      // Verificar si el navegador soporta la API de Barcode Detection
      if (!('BarcodeDetector' in window)) {
        throw new Error('Tu navegador no soporta escaneo de QR');
      }

      // Solicitar permisos de cámara
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      setIsScanning(true);
      return stream;
    } catch (err) {
      setError('Error al acceder a la cámara: ' + err.message);
      setIsScanning(false);
      return null;
    }
  };

  const stopScanning = (stream) => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setIsScanning(false);
  };

  return { isScanning, error, startScanning, stopScanning, setError };
};