import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { useEditor } from './state/store'
import './styles.css'

// só em desenvolvimento: facilita inspecionar/automatizar o editor pelo console
if (import.meta.env.DEV) (window as unknown as { __d3d: typeof useEditor }).__d3d = useEditor

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
