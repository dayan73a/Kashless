import { useState, useCallback } from 'react'

const useBLE = () => {
  const [devices, setDevices] = useState([])
  const [connectedDevice, setConnectedDevice] = useState(null)
  const [isScanning, setIsScanning] = useState(false)

  // Simulación para web - en producción usarías la librería real
  const scanForDevices = useCallback(() => {
    setIsScanning(true)
    
    // Simular descubrimiento de dispositivos
    const simulatedDevices = [
      { 
        id: 'simulated-esp32', 
        name: 'Kashless_Machine_01',
        localName: 'Kashless_Machine_01',
        connect: async () => {
          console.log('Conectando a dispositivo simulado...')
          return { 
            discoverAllServicesAndCharacteristics: async () => {
              console.log('Servicios descubiertos')
            }
          }
        }
      }
    ]

    setDevices(simulatedDevices)
    
    setTimeout(() => {
      setIsScanning(false)
    }, 3000)
  }, [])

  const connectToDevice = useCallback(async (device) => {
    try {
      console.log('Conectando a:', device.name)
      const connected = await device.connect()
      setConnectedDevice(connected)
      return connected
    } catch (error) {
      console.error('Error conectando:', error)
      throw error
    }
  }, [])

  const sendCommand = useCallback(async (command) => {
    if (!connectedDevice) throw new Error('No device connected')
    
    console.log('Enviando comando:', command)
    
    // Simular envío de comando
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('Comando ejecutado:', command)
        resolve()
      }, 1000)
    })
  }, [connectedDevice])

  const disconnectDevice = useCallback(async () => {
    setConnectedDevice(null)
    console.log('Dispositivo desconectado')
  }, [])

  return {
    devices,
    connectedDevice,
    isScanning,
    scanForDevices,
    connectToDevice,
    sendCommand,
    disconnectDevice
  }
}

export default useBLE