# Projeto Interiores (Design3D)

Editor 3D interativo para criar e editar ambientes internos e externos com medidas reais, com IA integrada: a pessoa descreve o ambiente e a IA monta ou altera a cena. Inspirado em [sael.net/interior](https://sael.net/interior/).

- **Plano, decisões e marcos:** [PLANO.md](PLANO.md)
- **Formato da cena (contrato entre motor 3D, editor e IA):** [schema/README.md](schema/README.md)
- **Como contribuir (branches, PRs, quem cuida do quê):** [CONTRIBUTING.md](CONTRIBUTING.md)

## Estrutura

```
PLANO.md      plano do projeto
schema/       formato da cena: JSON Schema, tipos TypeScript, validador, exemplos
app/          aplicação React + Vite (PWA)
  src/three/  motor 3D (React Three Fiber)
ai/           servidor MCP e integração com IA
assets/       modelos GLB, texturas, catálogo, scripts do Blender
```

## Validar o formato da cena

```bash
cd schema
npm ci
npm run validar
```
