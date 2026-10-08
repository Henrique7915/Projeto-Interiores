# Plano de distribuição

> Dono: frente **Arquitetura e coordenação**. Última revisão: 2026-10-08.
> Hoje o app está publicado para a família em https://henrique7915.github.io/Projeto-Interiores/ (PWA, GitHub Pages, repositório público).

O caminho vai do uso em família até as lojas de app em quatro fases. Cada fase só começa quando a anterior estiver estável, e nenhuma exige reescrever o app: o mesmo código web vira site, app instalável, app de computador e app de celular.

## Onde estamos (fase 0: família)

| Tema | Hoje |
|---|---|
| Endereço | GitHub Pages, publicado a cada mudança na `main` |
| Instalação | PWA: "Instalar app" no Chrome/Edge (computador e Android) e "Adicionar à Tela de Início" no iPhone |
| Contas | Nenhuma; cada pessoa guarda os projetos no próprio aparelho (IndexedDB) |
| Compartilhar | Link com a cena comprimida no endereço (`#s=…`), sem servidor |
| IA | Chave da própria pessoa no chat, servidor MCP local para Claude Desktop/Code, ou copiar/colar em qualquer IA |
| Custo | Zero |

Limites conhecidos: projetos não passam de um aparelho para outro sem exportar o arquivo, links de cenas muito grandes ficam longos demais para alguns apps de mensagem, e quem não tem chave de IA só usa o copiar/colar.

## Fase 1: família com nuvem

Objetivo: abrir o mesmo projeto no celular e no computador, e compartilhar sem link gigante.

- Login com Google ou e-mail e projetos salvos na nuvem. Sugestão: **Supabase** (autenticação, banco Postgres e armazenamento de miniaturas, com plano gratuito que cobre uso familiar).
- Continua funcionando offline. A nuvem só sincroniza quando há conexão, e o arquivo `.json` segue sendo o formato de troca.
- Links curtos (`/p/abc123`) apontando para a cena salva, com permissão "ver" ou "editar".
- Migração automática de cenas antigas pelo campo `version` do formato (0.1 → 0.2 → …).
- Teste de ponta a ponta no CI: abrir os exemplos no navegador e falhar se houver erro no console (o roteiro já existe na revisão da Arquitetura).

## Fase 2: público (beta aberto)

Objetivo: qualquer pessoa usar pelo navegador.

- **Domínio próprio** e hospedagem com CDN (Cloudflare Pages ou Vercel; o GitHub Pages também serve).
- **LGPD:** política de privacidade, termos de uso, exclusão de conta e de dados, e consentimento antes de qualquer telemetria.
- **Licenças:** auditoria do catálogo. Todo modelo e textura precisa ter `license` e `source` no `catalog.json`. Só CC0 ou próprios.
- **IA para quem não tem chave:** um servidor intermediário com a chave do projeto, limites por usuário e moderação. Isso tem custo por uso, então essa decisão vem junto com a de monetização.
- Relatório de erros (Sentry ou parecido), métricas de desempenho em celulares fracos e acessibilidade básica (teclado, contraste, leitor de tela nos painéis).
- Interface em português e inglês (o catálogo já aceita nomes por idioma).

## Fase 3: lojas de app

Objetivo: instalar pelas lojas e funcionar melhor offline.

| Plataforma | Como | Exige |
|---|---|---|
| Windows e macOS | **Tauri**, que embrulha o app web num executável leve | Certificado de assinatura de código para não aparecer o alerta de "app desconhecido" |
| Android | **Capacitor** (ou TWA, que publica o próprio PWA) | Conta Google Play (taxa única) |
| iPhone e iPad | **Capacitor** | Conta Apple Developer (anuidade) e revisão da Apple |

Cuidados: desempenho de WebGL no iPhone, salvamento de arquivos pelo sistema de cada plataforma e regras das lojas para compras dentro do app, se houver plano pago.

## Decisões que são do Henrique

Não precisam ser tomadas agora. Cada uma destrava uma fase:

1. **Fase 1:** usar login e nuvem (Supabase ou outro), e quem da família entra.
2. **Fase 2:** nome e marca do app e domínio; se haverá plano pago (ex.: grátis com catálogo básico e pago com nuvem, catálogo completo e créditos de IA); e se a IA do app usa chave própria (custo do projeto) ou só a do usuário.
3. **Fase 3:** abrir as contas de desenvolvedor da Apple e do Google em nome de quem vai publicar.

## Pré-requisitos técnicos (antes da fase 2)

- Formato da cena estável, com migrações testadas entre versões.
- Testes de ponta a ponta no CI e orçamento de desempenho (tempo para abrir uma cena e quadros por segundo num celular intermediário).
- Catálogo com licenças completas e miniaturas de todos os itens.
- Revisão de segurança da integração com IA: a chave nunca sai do aparelho e o servidor MCP só escuta em `localhost`.
