import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 仅保留 shadcn 需要的路径别名
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // 保留你原有的跨域代理配置
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})