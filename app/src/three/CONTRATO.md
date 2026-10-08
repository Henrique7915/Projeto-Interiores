# Contrato App ↔ motor 3D (`app/src/three/`)

Dono desta pasta: frente **Gráficos 3D**. O App só importa `app/src/three/index.ts`. Os tipos estão em `types.ts`.

```tsx
<SceneView
  ref={handleRef}            // SceneViewHandle: capture(), exportGLB(), setView(), getView(), timeOfPreset()
  scene={scene}              // Scene de schema/types.ts (nunca muda aqui dentro)
  selection={selection}      // { kind: 'room'|'wall'|'opening'|'object'|'zone'|'site', id, side? } | null
  onPick={(sel) => ...}      // clique em superfície/objeto (null = vazio); parede informa side: 'left' | 'right'
  onDragEnd={(e) => ...}     // arrasto/giro de objeto terminou: { id, position:[x,y,z], rotationDeg? }
  onDelete={(id) => ...}     // Delete/Backspace com objeto selecionado
  quality="low"|"medium"|"high"   // teto; adaptive (padrão ligado) desce de nível se o aparelho não acompanhar
/>
```

Regras:
- O motor **não altera a cena**; só emite eventos. O App vira comando e atualiza o estado.
- `position` de `onDragEnd` está no espaço da cena (a elevação do andar já foi descontada); `rotationDeg` entra em 0..360.
- Hora do dia: por padrão vem de `scene.environment.timeOfDay`. Para o sol arrastável atualizar a cena, ligue `onTimeChange` a `setEnvironment`.
- Vistas salvas (`scene.views`): `handle.setView(view)`; para criar uma, `handle.getView()` devolve `position`, `target` e `fovDeg`.
- Materiais e itens: o motor lê `assets/catalog.json` (importado da raiz) e os materiais inline da cena.
- Props novas: acrescente em `types.ts` e avise a frente de Gráficos.
- O canvas só desenha quando algo muda (`frameloop="demand"`). Mudar `scene`, `selection`, `timeOfDay`, `view`, `cutaway` ou `quality` já pede um quadro; o App não precisa fazer nada.
- Móveis com `model: "models/<nome>.glb"` carregam de `assets/models/` (relativo à página, funciona no GitHub Pages) e caem no desenhista procedural se falhar.
