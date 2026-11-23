import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // API 요청은 `npm run dev:api`(wrangler, 8788)로 전달
      '/api': { target: 'http://localhost:8788', changeOrigin: false },
    },
  },
})
