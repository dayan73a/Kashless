import { useState, useEffect } from 'react'

const usePlatform = () => {
  const [isMobile, setIsMobile] = useState(false)
  const [isWeb, setIsWeb] = useState(true)

  useEffect(() => {
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
    
    setIsMobile(isMobileDevice)
    setIsWeb(!isMobileDevice)
  }, [])

  return { isMobile, isWeb }
}

export default usePlatform