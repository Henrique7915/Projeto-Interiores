import { createRoot } from 'react-dom/client'
import { PreviewPage } from './PreviewPage'

// Página só de desenvolvimento: http://localhost:5173/src/three/dev/preview.html?preview=<catalogId>
// (usada por assets/scripts/thumbnails.mjs). Não entra no build do app.
createRoot(document.getElementById('root')!).render(<PreviewPage />)
