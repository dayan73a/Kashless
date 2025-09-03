import { useState, useEffect } from 'react'

const usePlatform = () => {
  const [isMobile, setIsMobile] = useState(false)
  const [isWeb, setIsWeb] = useState(true) // Por defecto web para desarrollo

  useEffect(() => {
    // Detectar si es móvil o web
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
    
    setIsMobile(isMobileDevice)
    setIsWeb(!isMobileDevice)
  }, [])

  return { isMobile, isWeb }
}

export default usePlatform