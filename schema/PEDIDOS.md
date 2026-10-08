# Pedidos de mudança no formato da cena

Escreva aqui o que precisa mudar em `scene.schema.json` ou `catalog.schema.json`: o que, por quê e um exemplo de JSON. A frente de Arquitetura aplica no schema, nos tipos, no validador e nos exemplos, e marca o pedido como feito.

## Abertos

Nenhum.

## Feitos

- **2026-10-08, App (PR #21):** comandos para a v0.2: `addLevel`/`updateLevel`/`removeLevel`, `addRoof`/`updateRoof`/`removeRoof`, `addSlabOpening`/`updateSlabOpening`/`removeSlabOpening`, `setTreatment`, `groupObjects`/`ungroup`, `addDimension`/`addLabel`/`updateAnnotation`/`removeAnnotation` e `setMaterial` em telhado. Na planta: cotas, grupos e troca de andar. Mover um móvel de grupo leva o grupo junto.
- **2026-10-08, Gráficos (PRs #18 e #19):** o motor 3D desenha toda a v0.2: telhados (`flat`, `shed`, `gable`, `hip`), vão de escada com guarda-corpo, cortinas e persianas, forro rebaixado, relevo do terreno e andares empilhados. O catálogo ganhou `stairs/straight`, `stairs/l-shaped` e `ceramic/roof-tile`. Limite conhecido: o telhado cobre o retângulo orientado que envolve o polígono, então só fica exato em planta retangular.
- **2026-10-08, App (PR #15):** ambientes vizinhos compartilham a parede comum (dividida no trecho em comum), em `addRoom`, `resizeRoom`, `moveRoom` e `removeRoom`. Os ambientes da parede ficam em `extensions["app.roomId"]` (o primeiro) e `extensions["app.roomIds"]` (a lista, só com 2 ou mais).
- **2026-10-08, Gráficos:** `catalog.schema.json` não resolvia `$ref` para `scene.schema.json` (relativo a um `$id` diferente). Os dois `$id` agora ficam em `https://design3d.local/schema/v0.1/`, então a referência relativa funciona. O validador ganhou `validateCatalog` e confere cenas contra o catálogo.
