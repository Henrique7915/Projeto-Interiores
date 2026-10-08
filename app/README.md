# Design 3D — app

React + TypeScript + Vite + React Three Fiber, PWA. Dono: frente **App e integração com IA** (exceto `src/three/`, que é da frente de Gráficos 3D).

## Rodar

```bash
npm install          # na raiz do repositório, uma vez
npm run dev          # http://localhost:5173
npm test             # testes do núcleo (comandos da cena)
npm run build        # tsc + vite build (app/dist)
```

`assets/` (na raiz do repositório) (catálogo, GLBs, texturas) é servido em `/assets/` no dev e copiado no build. O app carrega `assets/catalog.json` e `assets/materials.json` se existirem; senão usa o catálogo embutido (`src/core/fallbackCatalog.ts`).

## Estrutura

| Pasta | O que tem |
|---|---|
| `src/core/` | Núcleo sem React: comandos (`ops.ts`), catálogo, geometria, análise, links, templates. **Usado também pelo servidor MCP** (`ai/`). |
| `src/state/` | Store Zustand (cena, desfazer/refazer, seleção), ações de alto nível, atalhos |
| `src/ui/` | Painéis (moodboard, paleta, luz do dia, inspetor), barra superior, diálogos |
| `src/plan/` | Planta 2D com medidas |
| `src/chat/` | Chat de IA e conexão MCP |
| `src/three/` | **Motor 3D (Gráficos)** — contrato em `src/three/CONTRATO.md` |

## Regra de ouro

Toda mudança na cena passa por um comando de `src/core/ops.ts` (`applyOps`). Editor, chat e MCP usam os mesmos comandos; o resultado sempre valida contra `schema/scene.schema.json`.
