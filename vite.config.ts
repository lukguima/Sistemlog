import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  server: {
    host: true,
    // Dev: proxy /auth → BFF local (npm run dev:auth). Produção: nginx faz o mesmo.
    proxy: {
      '/auth': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})
