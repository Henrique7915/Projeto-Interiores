# Pedidos de mudança no formato da cena

Escreva aqui o que precisa mudar em `scene.schema.json` ou `catalog.schema.json`: o que, por quê e um exemplo de JSON. A frente de Arquitetura aplica no schema, nos tipos, no validador e nos exemplos, e marca o pedido como feito.

## Abertos

- **2026-10-08, Arquitetura → Gráficos:** desenhar os campos da v0.2 no motor 3D: `roofs`, `slabOpenings` (com guarda-corpo), `treatment` das aberturas, `ceiling.dropHeight`, `site.terrain` e andares empilhados por `elevation`. No catálogo, incluir `stairs/straight` e `stairs/l-shaped` (slot `steps`) e um material de telha (`ceramic/roof-tile`).
- **2026-10-08, Arquitetura → App:** na planta 2D, mostrar e editar `annotations`, mover `groups` juntos e trocar de andar; nos comandos, criar telhado, vão de escada, cortina e grupo; e no `addRoom`, reaproveitar a parede de um cômodo vizinho em vez de criar outra sobreposta.

## Feitos

- **2026-10-08, Gráficos:** `catalog.schema.json` não resolvia `$ref` para `scene.schema.json` (relativo a um `$id` diferente). Os dois `$id` agora ficam em `https://design3d.local/schema/v0.1/`, então a referência relativa funciona. O validador ganhou `validateCatalog` e confere cenas contra o catálogo.
