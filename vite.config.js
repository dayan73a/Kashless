import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis', // Polyfill para global
  },
  resolve: {
    alias: {
      // Polyfills para módulos de React Native
      'react-native': 'react-native-web',
      'stream': 'stream-browserify',
      'buffer': 'buffer',
      'crypto': 'crypto-browserify',
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      // Definir global para esbuild
      define: {
        global: 'globalThis',
      },
    },
  },
})