import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Expose the server to the network
    port: 5173, // The port Vite will run on
    watch: {
      usePolling: true, // Use polling for file changes in Docker
    },
    proxy: {
      '/api': {
        target: 'http://app:3000', // Proxy API requests to the backend service
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://app:3000', // Proxy static file requests to the backend service
        changeOrigin: true,
        secure: false,
      },
    },
  },
  optimizeDeps: {
    include: ['react-router-dom'],
  },
})
