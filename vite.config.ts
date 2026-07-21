/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5193',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:5193',
        changeOrigin: true,
        secure: false,
      },
      '/Uploads': {
        target: 'http://localhost:5193',
        changeOrigin: true,
        secure: false,
      },
      '/hub': {
        target: 'http://localhost:5193',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
})
