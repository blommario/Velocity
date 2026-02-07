import { defineConfig, type PluginOption } from 'vite'
import { exec } from 'child_process'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const BRAVE_PATH = 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe'

function openBrave(): PluginOption {
  let opened = false
  return {
    name: 'open-brave',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        if (opened) return
        opened = true
        const address = server.resolvedUrls?.local[0] ?? 'http://localhost:5173'
        exec(`"${BRAVE_PATH}" "${address}"`)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), openBrave()],
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
  build: {
    target: 'esnext',
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://localhost:5001',
        changeOrigin: true,
        secure: false, // Accept self-signed dev cert
      },
    },
  },
})
