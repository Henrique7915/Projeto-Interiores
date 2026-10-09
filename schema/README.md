# Formato da cena Design3D (v0.2)

Este é o contrato entre as três frentes e qualquer IA que edite ambientes. Uma cena é um único JSON que descreve o ambiente com medidas reais. O motor 3D desenha a partir dele, o editor altera ele, e a IA do usuário lê e escreve ele.

| Arquivo | O que é |
|---|---|
| `scene.schema.json` | JSON Schema (draft 2020-12) da cena |
| `catalog.schema.json` | Contrato do catálogo de móveis, materiais e presets de clima (`assets/catalog.json`) |
| `types.ts` | Tipos TypeScript equivalentes, para o app importar |
| `validar.mjs` | Validador: schema + regras de consistência. `node validar.mjs cena.json`, ou `import { validateScene, validateCatalog }`. Com `assets/catalog.json` presente, valida o catálogo e avisa sobre itens e materiais que não existem nele |
| `exemplos/` | `studio-aconchegante.json` (interno, inspirado no exemplo), `quintal-com-piscina.json` (externo), `casa-dois-andares.json` (v0.2: andares, escada, telhado, relevo) e `casa-joao.json` (projeto real tirado de uma planta em PDF: dois andares, piscina, área gourmet, sauna) |

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

**Erros:** ids repetidos, abertura fora da parede ou mais alta que ela, aberturas sobrepostas, parede de comprimento zero, polígono que se cruza ou de área zero, referências quebradas (`wallId`, `parentId`, `roomId`), grupo com objeto inexistente, objeto em dois grupos e cota de comprimento zero.

**Avisos:** paredes sobrepostas na mesma linha (cômodos colados com uma parede cada; a porta numa delas fica tapada pela outra), telhado inclinado sem `pitchDeg` e, quando há catálogo, `catalogId` ou material que não existe nele.

## O que entrou na v0.2

Tudo é opcional: uma cena 0.1 continua válida sem mudar nada. Para usar os campos novos, grave `"version": "0.2.0"`.

| Campo | Para quê |
|---|---|
| `levels[].roofs[]` | Telhado plano, de uma, duas ou quatro águas sobre um polígono (`kind`, `pitchDeg`, `ridgeDeg`, `overhang`, `baseHeight`) |
| `levels[].slabOpenings[]` | Vão no piso do andar, para escada ou mezanino, com guarda-corpo opcional |
| `levels[].groups[]`, `site.groups[]` | Objetos que se movem juntos (mesa com cadeiras). Um objeto só pode estar num grupo |
| `levels[].annotations[]`, `site.annotations[]` | Cotas (`dimension`, de `start` a `end`) e textos (`label`) desenhados na planta |
| `openings[].treatment` | Cortina, voal, persiana ou rolô, com material e quanto está aberta |
| `rooms[].ceiling.dropHeight` | Forro rebaixado ou sanca |
| `site.terrain` | Relevo por pontos cotados `[x, z, altura]`; o motor interpola |

Andares de cima: `elevation` do andar = `elevation` + `height` + `slabThickness` do andar de baixo (no exemplo, 0 + 2,8 + 0,12 = 2,92). Escada é um objeto do catálogo (`stairs/*`) no andar de baixo, e o vão fica em `slabOpenings` do andar de cima.

## Versionamento

`version` segue semver. Mudanças compatíveis (campos novos opcionais) sobem o patch/minor; o app guarda migrações de uma versão para a seguinte. Para pedir mudança no formato, a frente escreve em `schema/PEDIDOS.md` e a frente de Arquitetura aplica.

## Planejado para depois

Paredes curvas, telhados com águas de alturas diferentes, iluminação por cômodo (cenas de luz), camadas de projeto (existente / reforma) e unidades imperiais na exibição.
