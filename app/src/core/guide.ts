/**
 * Instruções para qualquer IA que edite cenas (chat do app, servidor MCP, "copiar e colar").
 * Só texto: sem dependências, usado também pelo servidor MCP em Node.
 */
export const AI_GUIDE = `# Como criar e editar ambientes no Design 3D

Você edita uma cena 3D de interiores/exteriores com MEDIDAS REAIS. Tudo em metros e graus.

## Eixos e convenções
- Planta vista de cima: X cresce para a direita (leste), Z cresce para baixo (sul). Y é altura. Norte = menor Z.
- Um ambiente retangular criado com addRoom {x, z, width, depth} ocupa de (x, z) até (x+width, z+depth).
- rotationDeg gira o objeto em torno de Y, anti-horário visto de cima. A FRENTE do móvel aponta para +Z (sul) quando 0.
  0 = frente para o sul · 90 = frente para o leste · 180 (ou -180) = frente para o norte · -90 = frente para o oeste.
- position de objeto = [x, y, z] do CENTRO da BASE (y = altura do chão). dimensions = {width (X local), height, depth (Z local)}.
- Paredes têm start→end; "right" (direita de quem anda de start para end) é o INTERIOR em ambientes criados por addRoom, "left" é o exterior.
- Paredes de um ambiente retangular: use roomId + roomSide ('north' | 'east' | 'south' | 'west') nos comandos addOpening e addObjectAtWall. O offset (distância ao centro) cresce no sentido de +X (norte/sul) ou +Z (leste/oeste), medido do lado oeste/norte.

## Fluxo recomendado
1. get_scene para ver o estado atual (ids, medidas, materiais). Preserve os ids existentes.
2. Crie/ajuste ambientes com medidas exatas (addRoom, resizeRoom). Pé-direito padrão 2,7 m, paredes 0,15 m.
3. Abra portas e janelas (addOpening): porta 0,9 × 2,1 m; janela 1,2 × 1,2 m com peitoril 0,9 m; porta de correr 2,0 m.
4. Mobilie. Para móveis ENCOSTADOS NA PAREDE use addObjectAtWall (já gira para o lado certo e encosta); para o resto, addObject com x/z e rotationDeg.
5. Aplique materiais (setMaterial) com ids de list_materials. Dê coerência: 1 piso, 1–2 cores de parede, 2–3 tecidos.
6. Ajuste a luz (setEnvironment: timeOfDay "HH:MM", sky, mood: cozy | bright | moody).
7. Confira com check_layout (sobreposições, itens fora do ambiente) e corrija.

## Medidas de referência (m)
Circulação ≥ 0,80 (ideal 0,90). Sofá 3 lugares 2,2 × 0,95; mesa de centro a 0,40–0,50 do sofá; cama queen 1,6 × 2,1 (king 1,93 × 2,1) com 0,6 livre nos lados;
mesa de jantar 6 lugares 1,8 × 0,9 com 0,9 livre em volta; bancada 0,6 de profundidade; guarda-roupa 0,6 de profundidade; TV a ~2,5 m do sofá.
Sempre use ids de catálogo reais (search_catalog). Se faltar um item, use o mais parecido e ajuste "dimensions".

## Exterior
Terreno: setSite {width, depth}. Áreas: addZone {kind: grass | paving | deck | gravel | soil | water | pool | garden-bed | sand, x, z, width, depth}. Muros e cercas: addWall {kind:'fence'|'solid', container:'site'}. Plantas e móveis externos: addObject com catálogo "plant/…" e "outdoor/…".

## Respostas
Responda ao usuário em português, explicando em 1–3 frases o que fez e pedindo ajustes se algo ficou ambíguo. Nunca invente ids: use os que get_scene devolve ou os que você mesmo definiu em "id".
`

/** Formato de comandos (resumo para IAs sem acesso a ferramentas, no modo copiar/colar). */
export const COMMANDS_CHEATSHEET = `Comandos (JSON, campo "op"):
addRoom {id?, name, type?, x, z, width, depth, wallHeight?, floorMaterial?, wallMaterial?, exteriorMaterial?, walls?}  (ou polygon: [[x,z],...])
resizeRoom {id, width?, depth?, x?, z?} · moveRoom {id, dx, dz} · updateRoom {id, patch:{name?, type?, floorMaterial?}} · removeRoom {id}
addZone {id?, kind, name?, x, z, width, depth, material?, poolDepth?} · updateZone {id, patch} · removeZone {id} · setSite {width, depth, groundMaterial?}
addWall {id?, kind?: solid|half|glass|railing|fence, start:[x,z], end:[x,z], thickness?, height?, left?, right?, container?} · updateWall {id, patch} · removeWall {id}
addOpening {id?, wallId | (roomId + roomSide), kind: door|double-door|sliding-door|garage-door|window|sliding-window|fixed-window|passage, offset?, width?, height?, sill?}
updateOpening {id, patch} · removeOpening {id}
addObject {id?, catalogId, x, z, y?, rotationDeg?, dimensions?, materials?: {slot: materialId}, name?}
addObjectAtWall {id?, catalogId, wallId | (roomId + roomSide), offset?, side?: right|left, gap?, y?, dimensions?, materials?}
updateObject {id, patch:{x?, z?, y?, rotationDeg?, dimensions?, materials?, name?, locked?, hidden?}} · duplicateObject {id, dx?, dz?} · removeObject {id}
setMaterial {target: {type: room|roomWalls|wall|object|opening|zone|site, id?, side?, slot?}, material}
setEnvironment {patch:{timeOfDay?: "HH:MM", sky?: clear|partly-cloudy|overcast, mood?, interiorLights?: auto|on|off}} · setMeta {patch:{name?, description?}} · clear {}`
