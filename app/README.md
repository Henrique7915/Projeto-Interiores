# Design 3D — app

React + TypeScript + Vite + React Three Fiber, PWA. Dono: frente **App e integração com IA** (exceto `src/three/`, que é da frente de Gráficos 3D).

## Rodar

```bash
npm install          # na raiz do repositório, uma vez
npm run dev          # http://localhost:5173
npm test             # testes do núcleo (comandos da cena)
npm run build        # tsc + vite build (app/dist)
```

`assets/` (na raiz do repositório) é servido em `/assets/` no dev e copiado no build. O catálogo de móveis e materiais é `assets/catalog.json`, importado direto pelo app e pelo motor 3D (fonte única).

## Usar no computador e no celular

- **Computador:** abra o endereço publicado (ou rode `npm run dev` na raiz e abra http://localhost:5173). No Chrome ou Edge dá para instalar como app pelo ícone na barra de endereço.
- **Celular:** abra o endereço publicado e use "Adicionar à tela inicial" (iPhone: Safari → Compartilhar) ou "Instalar app" (Android: Chrome). Os projetos ficam salvos no próprio aparelho; para levar para outro aparelho use Exportar (.json) ou o link compartilhável.
- **Publicação:** `.github/workflows/pages.yml` publica o app no GitHub Pages a cada mudança na `main` (precisa do repositório público e de Settings → Pages → Source: GitHub Actions).

## Andares, telhado, escada, cortina, grupos e cotas (schema v0.2)

- **Andares:** o seletor fica na planta (canto esquerdo) e no 3D. `addLevel` empilha um andar em cima do último; a planta mostra só o andar em edição, com o de baixo em sombra. No 3D, "Até este andar" esconde os de cima.
- **Telhado:** `addRoof` (plano, uma, duas ou quatro águas) sobre um ambiente ou área; aparece tracejado na planta. O botão "Telhado" do 3D alterna automático/mostrar/ocultar.
- **Escada:** objeto `stairs/*` no andar de baixo + `addSlabOpening` (vão com guarda-corpo) no piso do andar de cima. O painel "Andares, telhado e escada" faz os dois de uma vez.
- **Cortina:** `setTreatment` numa janela ou porta (cortina, voal, persiana, rolô, quanto está aberta).
- **Grupos:** `groupObjects`; mover um móvel do grupo (na planta, no 3D ou por comando) leva os outros junto.
- **Cotas e textos:** ferramentas "Cota fixa" e "Texto" da planta (`addDimension`, `addLabel`).
- **Paredes compartilhadas:** ambientes encostados dividem uma parede só (`app.roomIds`).

## Estrutura

| Pasta | O que tem |
|---|---|
| `src/core/` | Núcleo sem React: comandos (`ops.ts`), catálogo, geometria, análise, links, templates. **Usado também pelo servidor MCP** (`ai/`). |
| `src/state/` | Store Zustand (cena, desfazer/refazer, seleção), ações de alto nível, atalhos |
| `src/ui/` | Painéis (moodboard, paleta, luz do dia, inspetor), barra superior, diálogos |
| `src/plan/` | Planta 2D em SVG: zoom/pan, cotas, ferramentas (ambiente, parede, porta, janela, régua), arrastar e girar móveis, redimensionar ambientes por alças |
| `src/chat/` | Painel de IA: chat (chave do usuário), conexão MCP e copiar/colar. `src/lib/bridge.ts` sincroniza com o servidor MCP (`ai/`) |
| `src/three/` | **Motor 3D (Gráficos)**: contrato em `src/three/README.md`; o app só o usa em `src/ui/ThreeHost.tsx` |

## Regra de ouro

Toda mudança na cena passa por um comando de `src/core/ops.ts` (`applyOps`). Editor, chat e MCP usam os mesmos comandos; o resultado sempre valida contra `schema/scene.schema.json`.
