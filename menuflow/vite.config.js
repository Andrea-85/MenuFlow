import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 👈 Esto le dice a Vite que acepte conexiones de tu red local
    port: 5173
  }
})
