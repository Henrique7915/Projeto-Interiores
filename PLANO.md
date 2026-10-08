# Design3D: plano do projeto

> Dono deste arquivo: frente **Arquitetura e coordenação**. Outras frentes pedem mudanças em `schema/PEDIDOS.md` ou pelo coordenador.
> Última revisão: 2026-10-08.

## 1. O que estamos construindo

Um editor 3D interativo, no navegador, para criar e editar ambientes internos e externos **com medidas reais**, no estilo do exemplo [sael.net/interior](https://sael.net/interior/): vista isométrica bonita, materiais arrastáveis (madeira, pedra, tecido, tinta), móveis que se movem, sol que muda com a hora do dia e presets de clima (aconchegante, claro, noturno).

O diferencial é a **IA integrada**: a pessoa descreve o que quer ("sala de 4 x 5 m com sofá azul de frente para a janela") e a IA cria ou altera o ambiente. Funciona com o chat dentro do app e também com a IA que a pessoa já usa (Claude, ChatGPT etc.).

Uso inicial: Henrique e família. O projeto já nasce preparado para distribuição (contas, nuvem, lojas de app) mais tarde.

## 2. Decisões de arquitetura

| Tema | Decisão | Por quê |
|---|---|---|
| Plataforma | Web app **PWA** | Roda em PC, celular e tablet sem instalar; vira app de loja depois |
| Linguagem / build | **TypeScript + Vite** | Tipos compartilhados com o schema, build rápido |
| Interface | **React** | Ecossistema grande, combina com R3F |
| 3D | **Three.js via React Three Fiber** + drei | Padrão do mercado na web; o exemplo usa a mesma base |
| Estado | **Zustand + Immer**, histórico por patches | Desfazer/refazer barato e os mesmos comandos servem para a IA |
| Formato da cena | **JSON com JSON Schema** (`schema/`) | Uma única fonte de verdade que o motor, o editor e a IA entendem |
| Modelos 3D | **glTF/GLB**, criados ou ajustados no **Blender** (sem interface, por script) e otimizados com gltf-transform | Formato nativo da web, leve |
| Texturas | PBR, preferindo fontes **CC0** (Poly Haven, ambientCG, Kenney) | Sem problema de licença ao distribuir |
| Salvar | IndexedDB local + exportar/importar `.json` + **link compartilhável** com a cena comprimida na URL (como o `#r=` do exemplo) | Funciona sem servidor na fase família |
| IA | **Comandos de edição** + **servidor MCP** + **chat no app** (seção 4) | Qualquer IA conversa com o mesmo contrato |
| Distribuição futura | Tauri (desktop) / Capacitor (celular), backend com contas (ex.: Supabase) | Sem reescrever o app |

## 3. Arquitetura

```
             ┌──────────────────────── app (React) ────────────────────────┐
 usuário ──▶ │ painéis: planta 2D, moodboard, catálogo, medidas, hora do dia│
             │            │ comandos                                         │
             │            ▼                                                  │
             │   store da cena (Zustand) ── desfazer/refazer ── salvar       │
             │            │ Scene JSON (schema v0.1)                         │
             │            ▼                                                  │
             │   motor 3D (app/src/three, R3F): paredes, pisos, aberturas,   │
             │   móveis do catálogo, materiais PBR, sol, sombras, presets    │
             └────────────▲─────────────────────────────▲──────────────────┘
                          │ comandos                    │ comandos
                 chat de IA no app            servidor MCP (ai/mcp)
                 (chave do usuário)           ◀── Claude Desktop, Claude Code,
                                                   outras IAs com MCP
```

Regra de ouro: **toda mudança na cena passa por um comando** (`addWall`, `moveObject`, `setMaterial`...). O editor, o chat e o MCP usam a mesma lista de comandos, e todo resultado é validado por `schema/validar.mjs` antes de ser aceito.

## 4. Integração com IA (três caminhos)

1. **Chat dentro do app.** Painel de conversa que usa a API do Claude com a chave da própria pessoa (guardada só no aparelho). A IA recebe a cena atual + o catálogo resumido e responde com comandos. Mostra prévia e o usuário aceita ou desfaz.
2. **Servidor MCP `design3d`.** Para quem já usa Claude Desktop / Claude Code ou outra IA com MCP. Ferramentas previstas: `get_scene`, `apply_commands`, `create_scene`, `validate_scene`, `search_catalog`, `list_materials`, `snapshot` (imagem da vista). Conecta ao app aberto por WebSocket local ou trabalha direto num arquivo `.json`.
3. **Copiar e colar.** Botão "Exportar para IA" gera um texto com instruções + schema resumido + cena atual; a pessoa cola em qualquer chatbot, recebe um JSON de volta e importa. Funciona com qualquer IA, sem configurar nada.

Extras planejados: criar ambiente a partir de foto ou planta baixa (visão do modelo), sugestões de decoração por estilo, checagem de circulação (passagens mínimas) e de medidas.

## 5. Estrutura de pastas

O código vive no repositório [Henrique7915/Projeto-Interiores](https://github.com/Henrique7915/Projeto-Interiores). Fluxo de branches e PRs em `CONTRIBUTING.md`. O `progresso.json` fica fora do repositório, na pasta compartilhada do projeto (`/mnt/project-files/design3d/progresso.json`), porque muda o tempo todo e alimenta o painel.

```
Projeto-Interiores/
  PLANO.md            ← este arquivo (Arquitetura)
  CONTRIBUTING.md     ← fluxo de branches, PRs e posse de pastas
  schema/             ← formato da cena, tipos, validador, exemplos (Arquitetura)
  app/                ← aplicação React + Vite (App)
    src/three/        ← motor 3D (Gráficos)
  ai/                 ← servidor MCP, prompts e comandos para IA (App)
  assets/             ← modelos GLB, texturas, catalog.json, scripts do Blender (Gráficos)
```

## 6. Frentes e posse dos arquivos

| Frente | Dona de | Responsável por |
|---|---|---|
| **Arquitetura e coordenação** | `PLANO.md`, `schema/`, `progresso.json`, raiz do repositório e `.github/` | Contrato da cena, decisões, integração entre frentes, migração para o repositório, revisão do MVP |
| **Gráficos 3D** | `app/src/three/`, `assets/` | Geração 3D a partir do schema, materiais, iluminação, catálogo de móveis (Blender), desempenho |
| **App e integração com IA** | resto de `app/`, `ai/` | Interface do editor, store e comandos, medidas, salvar/compartilhar, chat de IA, servidor MCP |

Interfaces entre frentes:
- Gráficos expõe um componente `<SceneView scene={...} selection={...} onPick={...} />` e lê só o `Scene` de `schema/types.ts`.
- App é dona do estado; Gráficos nunca muda a cena diretamente, só emite eventos (`onPick`, `onDragEnd`) que o App transforma em comandos.
- O catálogo (`assets/catalog.json`) segue `schema/catalog.schema.json`; os ids usados em `schema/exemplos/` (`sofa/modern-l`, `wood/smoked-oak`...) são a lista inicial que Gráficos deve cobrir.

## 7. Marcos

| Marco | Resultado visível |
|---|---|
| **M0. Fundação** | Plano, schema v0, app vazio rodando, cena de exemplo aparece em 3D com paredes e piso |
| **M1. Ambiente básico** | Abrir o studio de exemplo com paredes, portas, janelas, pisos, móveis simples, sol e sombras; girar e dar zoom |
| **M2. Editor** | Desenhar paredes com medidas na planta 2D, inserir portas/janelas, arrastar móveis, trocar materiais (moodboard), desfazer/refazer, salvar e abrir |
| **M3. IA** | Chat no app cria e edita ambientes; servidor MCP funcionando com Claude Desktop; exportar/colar para outras IAs |
| **M4. Visual caprichado** | Catálogo com dezenas de móveis, materiais PBR, presets aconchegante/claro/noturno, ambientes externos (grama, deck, piscina), visual próximo ao exemplo |
| **M5. Uso em família** | PWA publicada, link compartilhável, funciona no celular, desempenho bom |
| **M6. Pronto para crescer** | Vários andares, telhados, contas e nuvem, app desktop/celular, licenças revisadas |

As etapas detalhadas de cada frente ficam em `progresso.json`, que alimenta o painel de progresso.

## 8. Como as frentes trabalham juntas

- **Antes de editar um arquivo compartilhado**, releia; faça edições pequenas; releia depois de uns segundos para confirmar que outra frente não sobrescreveu.
- **Código:** só por pull request na `main`, branch com o prefixo da frente (`arquitetura/`, `graficos/`, `app/`). Detalhes em `CONTRIBUTING.md`.
- **`progresso.json`:** cada frente marca só as próprias etapas (`"feito": true`) e atualiza `atualizado_em`. Pode adicionar etapas novas na própria frente.
- **Mudança no formato da cena:** escreva o pedido em `schema/PEDIDOS.md` (o que, por quê, exemplo). Arquitetura aplica no schema, nos tipos, no validador e nos exemplos.
- **Marcos concluídos** são avisados ao coordenador do projeto, que atualiza o painel.

## 9. Modelos de IA por tipo de tarefa (pedido do Henrique)

| Uso | Modelo |
|---|---|
| Delegação e coordenação | Opus 5.5, esforço alto |
| Produção (código, modelos, materiais) | Sonnet 5.5, esforço alto |
| Tarefas básicas (renomear, converter, checagens) | Haiku 5.5, esforço máximo |

## 10. Riscos e cuidados

- **Licenças de modelos e texturas:** registrar origem e licença de cada asset (`license` no catálogo). Só CC0 ou próprios até revisar.
- **Desempenho no celular:** limite de polígonos por móvel, texturas em KTX2, instancing, sombras ajustáveis.
- **IA gerando cena inválida:** todo comando é validado; erro volta para a IA com a mensagem do validador para ela corrigir.
- **Chave de API:** nunca vai para o código nem para o link compartilhável.
