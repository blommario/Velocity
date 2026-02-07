import { defineConfig, type PluginOption } from 'vite'
import { exec } from 'child_process'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

function openChrome(): PluginOption {
  let opened = false
  return {
    name: 'open-chrome',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        if (opened) return
        opened = true
        const address = server.resolvedUrls?.local[0] ?? 'http://localhost:5173'
        exec(`"${CHROME_PATH}" "${address}"`)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), openChrome()],
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
