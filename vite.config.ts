import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      // Ignore Print Bridge runtime/build artifacts to prevent reload storms.
      ignored: [
        '**/print-bridge/data/**',
        '**/print-bridge/release/**',
        '**/print-bridge/dist/**',
        '**/print-bridge/dist-electron/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
