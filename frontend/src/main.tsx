import './setup-webgpu'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installErrorCapture } from './stores/devLogStore'

installErrorCapture()
createRoot(document.getElementById('root')!).render(<App />)
