# Design 3D — servidor MCP (`ai/`)

Deixa a **IA que a pessoa já usa** (Claude Desktop, Claude Code ou qualquer cliente MCP) ler, criar e editar ambientes. Usa os mesmos comandos do editor (`app/src/core/ops.ts`) e valida tudo com `schema/validar.mjs` antes de aceitar.

## Rodar

```bash
npm install                 # na raiz do repositório
npm run mcp                 # modo stdio (é o que o Claude Desktop/Code executam)
npm run mcp:http            # só o bridge + MCP por HTTP: http://127.0.0.1:3737/mcp
```

Abra o app (`npm run dev`, ou o app publicado no GitHub Pages) → botão **IA** → aba **Minha IA (MCP)** → **Conectar**. O app e a IA passam a editar a mesma cena: o que a IA faz aparece ao vivo (e vira um passo de desfazer), e o que você edita a IA enxerga.

### Claude Desktop (`claude_desktop_config.json`)

```json
{ "mcpServers": { "design3d": { "command": "/CAMINHO/Projeto-Interiores/node_modules/.bin/tsx", "args": ["/CAMINHO/Projeto-Interiores/ai/src/cli.ts"] } } }
```

### Claude Code

```bash
claude mcp add design3d -- /CAMINHO/Projeto-Interiores/node_modules/.bin/tsx /CAMINHO/Projeto-Interiores/ai/src/cli.ts
# ou, com `npm run mcp:http` rodando:
claude mcp add --transport http design3d http://127.0.0.1:3737/mcp
```

Se mais de um processo subir (por exemplo o HTTP e o stdio), o primeiro é dono do bridge e os outros conectam nele: todos veem a mesma cena.

## Ferramentas

| Ferramenta | Para quê |
|---|---|
| `get_guide` | Convenções (eixos, rotação, lados da parede), medidas de referência, fluxo recomendado |
| `get_scene` | Cena em texto (ids, medidas, materiais) e/ou JSON oficial |
| `apply_commands` | Aplica comandos de edição; resultado validado, erros por comando |
| `create_scene` / `load_scene_json` | Nova cena (vazia ou exemplo) / importar JSON completo |
| `validate_scene`, `check_layout` | Schema + consistência / sobreposição e itens fora dos ambientes |
| `search_catalog`, `list_materials` | Ids de móveis (com medidas) e de materiais |
| `snapshot` | PNG da vista 3D do app aberto |

Também há o recurso `design3d://guia` e o prompt `projetar_ambiente`.

## Variáveis

| Variável | Padrão | |
|---|---|---|
| `D3D_PORT` | `3737` | porta do bridge |
| `D3D_HOME` | `~/.design3d` | onde fica `cena-atual.json` |
| `D3D_ASSETS` | `<repo>/assets` | catálogo oficial (`catalog.json`, `materials.json`) |
| `D3D_ALLOWED_ORIGINS` | — | origens extras do app (por padrão só `localhost`/`127.0.0.1`) |

## Segurança

O bridge escuta só em `127.0.0.1` e recusa requisições de páginas de outras origens (aceita só o app local, o app publicado em `https://henrique7915.github.io` e o que estiver em `D3D_ALLOWED_ORIGINS`). Nada sai do computador, e a chave de API do chat do app nunca passa por aqui.

## API do bridge (usada pelo app)

`GET /api/scene`, `PUT /api/scene` (`adopt: true` = a cena mais recente vence), `POST /api/ops`, `GET /api/events` (SSE), `POST /api/snapshot`, `POST /api/snapshot/:id`, `GET /api/health`, `POST /mcp`.
