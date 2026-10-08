# Formato da cena Design3D (v0.1)

Este é o contrato entre as três frentes e qualquer IA que edite ambientes. Uma cena é um único JSON que descreve o ambiente com medidas reais. O motor 3D desenha a partir dele, o editor altera ele, e a IA do usuário lê e escreve ele.

| Arquivo | O que é |
|---|---|
| `scene.schema.json` | JSON Schema (draft 2020-12) da cena |
| `catalog.schema.json` | Contrato do catálogo de móveis, materiais e presets de clima (`assets/catalog.json`) |
| `types.ts` | Tipos TypeScript equivalentes, para o app importar |
| `validar.mjs` | Validador: schema + regras de consistência. `node validar.mjs cena.json`, ou `import { validateScene, validateCatalog }`. Com `assets/catalog.json` presente, valida o catálogo e avisa sobre itens e materiais que não existem nele |
| `exemplos/` | `studio-aconchegante.json` (interno, inspirado no exemplo) e `quintal-com-piscina.json` (externo) |

Para validar: `cd schema && npm install && npm run validar`.

## Convenções (valem para todo o código)

- **Unidades:** metros sempre. A interface pode mostrar cm, mas grava em metros. Ângulos em graus.
- **Eixos:** Y para cima (como no Three.js). O chão é o plano XZ. Na planta, um ponto é `[x, z]`.
- **Rotação:** `rotationDeg` gira em torno de Y, sentido anti-horário visto de cima (o mesmo de `object.rotation.y` no Three.js, convertido para radianos).
- **Frente dos modelos:** todo modelo do catálogo tem a frente voltada para **+Z**, origem no centro da base, 1 unidade = 1 m. Com `rotationDeg = -90` a frente aponta para -X; com `90`, para +X; com `180`, para -Z.
- **Paredes:** segmento `start → end` na linha de centro, espessura centrada. `finish.left` e `finish.right` são os lados à esquerda e à direita de quem caminha de `start` para `end`, visto de cima. Normal do lado esquerdo = `normalize([dz, -dx])`.
- **Aberturas:** presas a uma parede por `wallId`; `offset` é a distância do `start` da parede até o **centro** da abertura; `sill` é o peitoril.
- **Objetos:** `position` é o centro da base, relativo ao piso do andar. `dimensions` são as medidas reais; o motor escala o modelo para caber nelas. Sem `dimensions`, valem as do catálogo.
- **Materiais:** referência por id. Primeiro procura em `scene.materials`, depois na biblioteca (`categoria/nome`, ex.: `wood/smoked-oak`, `fabric/navy-velvet`). Um material da cena pode herdar de outro com `base`.
- **Ids:** únicos na cena inteira, legíveis (`parede-fundo`, `sofa-sala`). A IA deve preservar ids existentes ao editar.
- **Campos desconhecidos são erro** (`additionalProperties: false`), para pegar erro de digitação da IA. Dados extras vão em `extensions` com prefixo do dono (`ai.*`, `app.*`, `three.*`).
- **Interno e externo:** `levels[]` são os andares; `site` é o terreno (zonas de grama, deck, piscina, muros, árvores), no mesmo sistema de coordenadas. Uma cena pode ter só um dos dois.

## Regras que o validador confere além do schema

Ids repetidos, abertura fora da parede ou mais alta que ela, aberturas sobrepostas, parede de comprimento zero, polígono que se cruza ou de área zero, e referências quebradas (`wallId`, `parentId`, `roomId`).

## Versionamento

`version` segue semver. Mudanças compatíveis (campos novos opcionais) sobem o patch/minor; o app guarda migrações de uma versão para a seguinte. Para pedir mudança no formato, a frente escreve em `schema/PEDIDOS.md` e a frente de Arquitetura aplica.

## Planejado para v0.2

Telhados e lajes inclinadas, escadas com vão no piso, forros rebaixados, cortinas/persianas, terreno com desnível (curvas de nível), grupos de objetos e medidas/cotas anotadas na cena.
