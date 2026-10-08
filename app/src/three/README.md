# Motor 3D (`app/src/three`)

Desenha um `Scene` do [schema](../../../schema/README.md) com React Three Fiber. **Dona:** frente Gráficos 3D.
O motor só lê a cena: toda mudança sai por eventos e o App transforma em comandos.

```tsx
import { SceneView } from './three'

<SceneView
  scene={scene}                      // Scene do schema (obrigatório)
  selection={pick}                   // ScenePick | null: destaque no 3D
  onPick={setPick}                   // clique em objeto, parede (lado), cômodo, abertura, zona; null = vazio
  onDragEnd={(id, { position, rotationDeg }) => ...}   // fim de arraste ou giro (R, Shift+R, Q, E)
  onDelete={(id) => ...}             // Delete/Backspace com objeto selecionado
  timeOfDay={18.5}                   // horas decimais ou "HH:MM"; sem valor usa scene.environment.timeOfDay
  onTimeChange={setTime}             // usuário arrastou o sol
  view="iso" | "top" | "front"
  cutaway="auto" | "none" | "all"    // paredes que tapam a vista ficam baixas
  quality="high" | "low"             // low: sem sombras nem pós-processamento (celular)
  ref={handle}                       // handle.capture() devolve PNG; handle.setView(...)
/>
```

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

## Convenções

- Metros, graus, Y para cima, frente dos móveis em +Z (ver schema).
- Parede: lado direito = +z local = normal `(-dz, dx)`; esquerdo = `finish.left`.
- Móvel novo: adicione o item em `assets/catalog/items.mjs`, o desenhista em `furniture/builders.tsx` e rode `node assets/catalog/build.mjs`.
- O catálogo é a fonte da verdade: ids de material são `categoria/nome`; um `texture.set` desconhecido vira cor lisa.
- O App precisa de `resolveJsonModule` no tsconfig e de `server.fs.allow: ['..']` no Vite (o motor importa `assets/catalog.json` da raiz).
