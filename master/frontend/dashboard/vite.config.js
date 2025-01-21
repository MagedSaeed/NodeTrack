import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// serverAddress = import.meta.env.SERVER_ADDRESS

export default defineConfig({
  envDir: "../../../",
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})