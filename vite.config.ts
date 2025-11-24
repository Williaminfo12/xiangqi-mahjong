import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 重要：確保資源路徑是相對的，適配所有 Hosting
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
})