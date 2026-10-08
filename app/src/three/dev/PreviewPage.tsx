import { ObjectPreview } from '../ObjectPreview'

/**
 * Página de miniatura: monte-a quando a URL tiver `?preview=<catalogId>` (ex.: `?preview=sofa/modern-l`).
 * Usada por `assets/scripts/thumbnails.mjs` para gerar `assets/thumbnails/*.png`.
 * Parâmetros opcionais: `size=<px>` (padrão 512), `lit=1` acende luminárias.
 */
export function PreviewPage() {
  const q = new URLSearchParams(location.search)
  const id = q.get('preview')
  const size = Number(q.get('size') ?? 512)
  if (!id) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'transparent' }}>
      <div id="preview-frame" style={{ width: size, height: size }}>
        <ObjectPreview catalogId={id} lit={q.get('lit') === '1'} />
      </div>
    </div>
  )
}

export const isPreviewUrl = () => new URLSearchParams(location.search).has('preview')
