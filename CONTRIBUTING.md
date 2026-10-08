# Como trabalhamos

O projeto é tocado por três frentes em paralelo. Cada uma cuida das suas pastas e entrega por pull request.

## Quem cuida do quê

| Frente | Pastas | Prefixo de branch |
|---|---|---|
| Arquitetura e coordenação | `PLANO.md`, `schema/`, arquivos da raiz, `.github/` | `arquitetura/` |
| Gráficos 3D | `app/src/three/`, `assets/` | `graficos/` |
| App e integração com IA | `app/` (exceto `src/three/`), `ai/` | `app/` |

Mexer na pasta de outra frente: só com combinado prévio com a dona (pelo coordenador do projeto). Mudança no formato da cena: pedido em [schema/PEDIDOS.md](schema/PEDIDOS.md).

## Fluxo

1. `main` está sempre funcionando. Ninguém faz push direto nela.
2. Uma branch por etapa, a partir da `main` atualizada: `graficos/paredes-e-pisos`, `app/store-da-cena`, `arquitetura/schema-v0-2`.
3. PRs pequenos, um por etapa do `progresso.json`. Título e descrição em português, dizendo o que dá para ver de diferente (Antes / Depois).
4. Antes de pedir merge: `git fetch origin main && git rebase origin/main`, e o CI precisa estar verde.
5. **A própria frente faz o merge** do seu PR, por **squash**, quando o CI está verde e, se o PR muda contrato (item 6), a Arquitetura aprovou. Depois apaga a branch. (Decisão do Henrique em 2026-10-08; ele acompanha pelo painel e pode reverter qualquer PR.)
6. PR que muda contrato entre frentes (`schema/`, props do `<SceneView>`, lista de comandos) precisa de revisão da Arquitetura.

## CI

O workflow `.github/workflows/ci.yml` valida o formato da cena e os exemplos. Cada frente acrescenta o job da sua parte (build, lint, testes) no mesmo arquivo quando a pasta dela passar a existir.

## Convenções de código

- TypeScript estrito. Tipos da cena vêm de `schema/types.ts`; nada de redefinir.
- Unidades em metros e graus em todo lugar (ver [schema/README.md](schema/README.md)).
- Toda mudança na cena passa por um comando validado por `schema/validar.mjs`.
- Assets: registrar origem e licença no catálogo. Só CC0 ou próprios.
- Nunca commitar chaves de API, `.env` ou `node_modules`.

## Progresso

O painel de progresso lê `/mnt/project-files/design3d/progresso.json` na pasta compartilhada do projeto (fora do repositório, porque muda o tempo todo). Cada frente marca as próprias etapas lá quando o PR correspondente entra na `main`.
