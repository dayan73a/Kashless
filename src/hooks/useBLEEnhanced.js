import { useState, useCallback } from 'react'
import usePlatform from './usePlatform'

const useBLEEnhanced = () => {
  const { isWeb } = usePlatform()
  const [devices, setDevices] = useState([])
  const [connectedDevice, setConnectedDevice] = useState(null)
  const [isScanning, setIsScanning] = useState(false)

  // Versión Web (Simulación) - MEJORADA
  const webScanForDevices = useCallback(() => {
    setIsScanning(true)
    
    // Dispositivos simulados con estructura más completa
    const simulatedDevices = [
      { 
        id: 'esp32-simulado-01', 
        name: 'Kashless_Machine_01',
        localName: 'Kashless_Machine_01',
        // Añadimos esta propiedad para compatibilidad
        deviceName: 'Kashless_Machine_01',
        connect: async () => {
          console.log('✅ Conectado a ESP32 simulado')
          return { 
            discoverAllServicesAndCharacteristics: async () => {
              console.log('🔍 Servicios descubiertos')
            }
          }
        }
      },
      { 
        id: 'esp32-simulado-02', 
        name: 'Kashless_Machine_02',
        localName: 'Kashless_Machine_02',
        // Añadimos esta propiedad para compatibilidad
        deviceName: 'Kashless_Machine_02',
        connect: async () => {
          console.log('✅ Conectado a ESP32 simulado 2')
          return { 
            discoverAllServicesAndCharacteristics: async () => {
              console.log('🔍 Servicios descubiertos')
            }
          }
        }
      }
    ]

    setDevices(simulatedDevices)
    
    setTimeout(() => {
      setIsScanning(false)
      console.log('🔍 Escaneo completado - Dispositivos encontrados:', simulatedDevices.length)
      console.log('📋 Dispositivos:', simulatedDevices.map(d => d.name || d.localName || d.deviceName))
    }, 1500) // Reducido a 1.5 segundos para mejor experiencia
    
    return simulatedDevices; // Devolvemos los dispositivos para testing
  }, [])

  // Versión Móvil (Real) - MEJORADA
  const mobileScanForDevices = useCallback(() => {
    console.log('📱 Escaneo BLE real en dispositivo móvil')
    setIsScanning(true)
    
    // En móvil, intentamos usar el escaneo real primero
    if (window.ble) {
      // Código para escaneo real con react-native-ble-plx
      console.log('📡 Iniciando escaneo BLE real...')
      // Tu implementación real aquí
    } else {
      // Fallback a simulación si no está disponible
      console.log('⚠️  Usando simulación BLE (modo desarrollo)')
      return webScanForDevices()
    }
  }, [webScanForDevices])

  const scanForDevices = isWeb ? webScanForDevices : mobileScanForDevices

  const connectToDevice = useCallback(async (device) => {
    try {
      console.log('🔗 Conectando a:', device.name || device.localName || device.deviceName)
      
      // Para dispositivos simulados
      if (device.connect) {
        const connected = await device.connect()
        if (connected.discoverAllServicesAndCharacteristics) {
          await connected.discoverAllServicesAndCharacteristics()
        }
        setConnectedDevice(connected)
        console.log('✅ Conexión exitosa')
        return connected
      } else {
        // Para dispositivos reales (aquí iría tu código de conexión real)
        console.log('📱 Conectando a dispositivo real...')
        // Tu implementación real de conexión BLE
        setConnectedDevice(device)
        return device
      }
    } catch (error) {
      console.error('❌ Error conectando:', error)
      throw error
    }
  }, [])

  const sendCommand = useCallback(async (command) => {
    if (!connectedDevice) throw new Error('No device connected')
    
    console.log('📤 Enviando comando:', command)
    
    if (isWeb) {
      // Simulación para web mejorada
      return new Promise((resolve) => {
        setTimeout(() => {
          console.log('✅ Comando ejecutado:', command)
          
          // Simular respuesta del ESP32
          if (command === 'START') {
            console.log('💡 LED encendido (simulado)')
          } else if (command === 'STOP') {
            console.log('💡 LED apagado (simulado)')
          } else if (command.startsWith('TIME:')) {
            const minutes = command.split(':')[1]
            console.log(`⏰ Tiempo programado: ${minutes} minutos (simulado)`)
          }
          
          resolve({ success: true, command })
        }, 800) // Reducido a 0.8 segundos
      })
    } else {
      // Código real para móvil
      console.log('📱 Enviando comando real a dispositivo móvil')
      // Tu implementación real para enviar comandos BLE
      return Promise.resolve({ success: true })
    }
  }, [connectedDevice, isWeb])

  const disconnectDevice = useCallback(async () => {
    if (connectedDevice && connectedDevice.cancelConnection) {
      // Para dispositivos reales
      await connectedDevice.cancelConnection()
    }
    setConnectedDevice(null)
    console.log('🔌 Dispositivo desconectado')
  }, [connectedDevice])

  // Función auxiliar para buscar dispositivo por nombre
  const findDeviceByName = useCallback((name) => {
    return devices.find(device => 
      (device.name && device.name === name) ||
      (device.localName && device.localName === name) ||
      (device.deviceName && device.deviceName === name)
    )
  }, [devices])

  return {
    devices,
    connectedDevice,
    isScanning,
    scanForDevices,
    connectToDevice,
    sendCommand,
    disconnectDevice,
    findDeviceByName, // Nueva función auxiliar
    isWeb
  }
}

export default useBLEEnhanced