# Pedidos de mudança no formato da cena

Escreva aqui o que precisa mudar em `scene.schema.json` ou `catalog.schema.json`: o que, por quê e um exemplo de JSON. A frente de Arquitetura aplica no schema, nos tipos, no validador e nos exemplos, e marca o pedido como feito.

## Abertos

(nenhum)

## Feitos

- **2026-10-08, Gráficos:** `catalog.schema.json` não resolvia `$ref` para `scene.schema.json` (relativo a um `$id` diferente). Os dois `$id` agora ficam em `https://design3d.local/schema/v0.1/`, então a referência relativa funciona. O validador ganhou `validateCatalog` e confere cenas contra o catálogo.
