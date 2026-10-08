# Motor 3D (`app/src/three`)

Desenha um `Scene` do [schema](../../../schema/README.md) com React Three Fiber. **Dona:** frente Gráficos 3D.
O motor só lê a cena: toda mudança sai por eventos e o App transforma em comandos.

```tsx
import { SceneView, type SceneViewHandle } from './three'

<SceneView
  ref={handle}                       // SceneViewHandle (abaixo)
  scene={scene}                      // Scene do schema (obrigatório; nunca é alterada aqui dentro)
  selection={sel}                    // { kind: 'room'|'wall'|'opening'|'object'|'zone'|'site', id, side? } | null
  onPick={setSel}                    // clique em objeto, parede (side left/right), cômodo, abertura, zona; null = vazio
  onDragEnd={({ id, position, rotationDeg }) => ...}   // fim de arraste ou giro (R, Shift+R, Q, E); position no espaço da cena
  onDelete={(id) => ...}             // Delete/Backspace com objeto selecionado
  quality="high" | "medium" | "low"  // teto de qualidade; low: sem sombras/pós-processamento/luzes reais (celular); medium: sombras leves, sem oclusão ambiente
  adaptive                           // padrão ligado: se o aparelho não acompanhar, desce high → medium → low sozinho
  // opcionais: padrão vem da cena
  timeOfDay={18.5}                   // horas decimais ou "HH:MM"; sem valor usa scene.environment.timeOfDay
  onTimeChange={setTime}             // usuário arrastou o sol (horas decimais)
  view="iso" | "top" | "front"
  cutaway="auto" | "none" | "all"    // paredes que tapam a vista ficam baixas
  snap={0.05}                        // grade do arraste (m); padrão scene.defaults.snap
/>
```

`SceneViewHandle`: `capture(): Promise<Blob>` (PNG), `exportGLB(): Promise<Blob>`, `setView(view | 'iso'|'top'|'front')` (vista salva do schema ou preset), `getView()` (posição/alvo/fov atuais, para salvar uma vista), `timeOfPreset('Manhã'|…)`.
O contrato completo está em `types.ts` e `CONTRATO.md`.

Outros exports de `index.ts`: `CATALOG`, `MATERIAL_LIBRARY`, `materialsByCategory`, `resolveMaterial`, `catalogItems`, `getCatalogItem`, `catalogMoods`, `TIME_PRESETS`, `formatTime`.
Os painéis do App (moodboard, catálogo de móveis) montam suas listas a partir deles; os slots de cada móvel estão em `CATALOG.items[].materialSlots`.

## Estrutura

| Pasta/arquivo | O que faz |
|---|---|
| `SceneView.tsx` | componente público, câmera, atalhos, pós-processamento |
| `adapter/toRender.ts` | `Scene` → `RenderScene` (materiais resolvidos, catálogo aplicado, padrões do schema) |
| `Architecture.tsx` | pisos, paredes (esquadria nos cantos, recorte por câmera), portas e janelas, rodapé |
| `Site.tsx` | terreno: grama, zonas (deck, pavimento, canteiro), piscina, muros e cercas |
| `geometry/walls.ts` | geometria de parede com vãos e topo inclinado |
| `furniture/builders.tsx` | móveis procedurais, um por `model: "procedural/<nome>"` do catálogo |
| `materials/` | biblioteca (`assets/catalog.json`), conjuntos de textura procedurais, materiais Three |
| `lighting/` | sol e lua por hora do dia, atmosfera, luminárias acendem à noite, sol arrastável |
| `interaction/Items.tsx` | seleção, arraste com grade e encaixe na parede |

## Desempenho

- O canvas usa `frameloop="demand"`: só desenha quando algo muda (câmera, hora, seleção, arraste, animações). Parado, não gasta GPU nem bateria. Quem anima em `useFrame` precisa chamar `invalidate()` enquanto não terminou (veja `Lighting` e `Wall`), e mudar um objeto Three direto (sem passar pelo React) também pede `invalidate()`.
- Três níveis em `SETTINGS` (`SceneView.tsx`): sombras, resolução (`dpr`), pós-processamento, oclusão ambiente e se as luminárias acendem luzes reais (`LightBudget`). Em `low` elas só brilham (material emissivo).
- `Governor` mede quadros em trechos contínuos e desce um nível se a média ficar abaixo de ~33 quadros/s por duas janelas seguidas.

## Modelos GLB (Blender)

- `assets/blender/modelos.py` gera os modelos por código: `blender --background --python assets/blender/modelos.py [-- sofa-3 armchair]` → `assets/models/<nome>.glb` (precisa do pacote `python3-numpy` para o exportador glTF).
- Convenção: metros, origem no centro da base, frente +Z, topo +Y; o **nome do material no GLB é o slot do catálogo** (`upholstery`, `legs`...). Materiais com outros nomes (folhas, caules) ficam como estão no arquivo. Sem UVs: o motor gera UVs em metros ao carregar, então a textura mantém a escala real.
- No catálogo: `model: "models/<nome>.glb"`. O nome do arquivo é também o do desenhista procedural em `furniture/builders*.tsx`, usado enquanto o GLB carrega ou se ele falhar. O modelo é esticado até as medidas do objeto na cena.
- Modelos prontos: `sofa-3`, `armchair`, `bed-queen`, `chair-dining`, `plant-monstera`, `toilet`.

## Páginas de desenvolvimento

Com `npm run dev` rodando: `/src/three/dev/viewer.html?scene=studio|quintal&q=low|medium|high&adaptive=0&t=18.5&view=iso|top|front` (motor sozinho, expõe `window.__vp` e `window.__setT`) e `/src/three/dev/preview.html?preview=<catalogId>` (miniatura, usada por `assets/scripts/thumbnails.mjs`).

## Convenções

- Metros, graus, Y para cima, frente dos móveis em +Z (ver schema).
- Parede: lado direito = +z local = normal `(-dz, dx)`; esquerdo = `finish.left`.
- Móvel novo: adicione o item em `assets/catalog/items.mjs`, o desenhista em `furniture/builders.tsx` e rode `node assets/catalog/build.mjs`.
- O catálogo é a fonte da verdade: ids de material são `categoria/nome`; um `texture.set` desconhecido vira cor lisa.
- O App precisa de `resolveJsonModule` no tsconfig e de `server.fs.allow: ['..']` no Vite (o motor importa `assets/catalog.json` da raiz).
