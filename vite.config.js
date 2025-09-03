// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// Config minimal y estable. Quitamos Babel del medio.
export default defineConfig({
  plugins: [react()],

  // Alias para librerías que esperan APIs de Node en el navegador (ya las tienes instaladas)
  resolve: {
    alias: {
      stream: 'stream-browserify',
      crypto: 'crypto-browserify',
      buffer: 'buffer',
    },
  },

  // Pequeños polyfills para que no fallen librerías que acceden a process/global
  define: {
    'process.env': {},
    global: 'globalThis',
  },

  // Forzamos a Vite a pre-empacar estos polyfills (evita warnings)
  optimizeDeps: {
    include: ['buffer', 'stream-browserify', 'crypto-browserify'],
  },
})
