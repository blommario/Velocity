/**
 * Application entry point — WebGPU setup, error capture, and React root mount.
 *
 * Depends on: @engine/core/setup-webgpu, @engine/stores/devLogStore, App
 * Used by: index.html
 */
import '@engine/core/setup-webgpu'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installErrorCapture } from '@engine/stores/devLogStore'

installErrorCapture()
createRoot(document.getElementById('root')!).render(<App />)
