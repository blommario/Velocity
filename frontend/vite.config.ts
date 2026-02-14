import { defineConfig, type PluginOption } from 'vite'
import { exec } from 'child_process'
import path from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

function openChrome(): PluginOption {
  let opened = false
  return {
    name: 'open-chrome',
    configureServer(server) {
      const _printUrls = server.printUrls
      server.printUrls = () => {
        _printUrls()
        if (opened) return
        opened = true
        const address = server.resolvedUrls?.local[0] ?? 'http://localhost:5173'
        exec(`"${CHROME_PATH}" "${address}"`)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), openChrome()],
  resolve: {
    alias: {
      '@engine': path.resolve(__dirname, 'src/engine'),
      '@game': path.resolve(__dirname, 'src/game'),
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
  build: {
    target: 'esnext',
  },
  server: {
    open: false,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      '/api': {
        target: 'https://localhost:5001',
        changeOrigin: true,
        secure: false, // Accept self-signed dev cert
      },
      // WebTransport uses HTTP/3 CONNECT — Vite proxy can't forward it.
      // In dev, client connects directly to https://localhost:5001 for WebTransport.
    },
  },
})
