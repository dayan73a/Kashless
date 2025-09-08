import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { resolve } from 'path'

export default defineConfig({
  base: './', // important for Capacitor
  plugins: [react()],

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html') },
      output: {
        entryFileNames: 'assets/index-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  },

  resolve: {
    alias: {
      stream: 'stream-browserify',
      crypto: 'crypto-browserify',
      buffer: 'buffer',
      // '@': new URL('./src', import.meta.url).pathname,
    },
  },

  define: {
    'process.env': {},
    global: 'globalThis',
  },

  optimizeDeps: {
    include: ['buffer', 'stream-browserify', 'crypto-browserify'],
  },

  server: {
    host: true,
    port: 5173
  }
})
