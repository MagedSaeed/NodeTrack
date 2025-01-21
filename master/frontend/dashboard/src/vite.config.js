import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

serverAddress = import.meta.env.SERVER_ADDRESS

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: `http://${serverAddress}:5000`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})