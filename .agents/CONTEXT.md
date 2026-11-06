# 🧭 Contexto do Projeto: gh-workflows

> **Versão da Documentação**: 2.0.0  
> **Última Atualização**: 2026-10-12  
> **Repositório**: [heliomarpm/gh-workflows](https://github.com/heliomarpm/gh-workflows)  
> **Arquitetura**: Composite GitHub Actions & Reusable Workflows (TypeScript + Node.js 24)

---

## 🎯 Propósito e Missão
O **`gh-workflows`** é um ecossistema opinativo e reutilizável de **GitHub Actions** e **Reusable Workflows** (`workflow_call`) concebido para padronizar e automatizar esteiras de CI/CD em múltiplos repositórios com **zero overhead de instalação no consumidor** (boot < 1s).

Sua principal responsabilidade abrange a governança de versionamento semântico (SemVer) derivado de Conventional Commits, geração e ciclo de vida do arquivo `CHANGELOG.md` (com suporte a seções `[Unreleased]` e conversão em versões datadas), orquestração de releases oficiais no GitHub via Octokit REST API, publicação em múltiplos registries e automação de Pull Requests.

---

## 🛠️ Stack Tecnológica & Dependências

| Componente | Tecnologia | Versão | Função / Observação |
| :--- | :--- | :--- | :--- |
| **Runtime Runners** | Node.js | `20+ LTS` / `24` | Execução oficial das actions (`using: node24`) |
| **Linguagem Base** | TypeScript | `^5.9.3` | Tipagem estrita com compilação ES2022/Node16 |
| **Bundler / Packager**| `@vercel/ncc` | `^0.45.0` | Empacotamento single-file autocontido em `dist/` |
| **Test Runner** | Vitest | `^5.0.3` | Testes unitários rápidos (< 4s) com mock de ambiente |
| **Linter & Formatter**| Biome | `^2.5.15` | Análise estática, formatação e verificação de regras |
| **GitHub Toolkit** | `@actions/core`, `@actions/exec`, `@actions/github` | `^3.x` / `^9.x` | APIs oficiais para I/O, comandos e Octokit |
| **Versionamento** | `semver` | `^7.8.5` | Validação, cálculo de incrementos e parsing SemVer |

---

## ⚡ Comandos Canônicos

```bash
# Dependências
npm install            # Instala dependências de desenvolvimento do projeto

# Qualidade e Linting (Biome)
npm run check          # Analisa linting e formatação de todos os arquivos
npm run check:fix      # Aplica correções automáticas de linting e formatação
npm run lint           # Executa apenas linter do Biome
npm run format         # Executa apenas formatação do Biome

# Testes Automatizados (Vitest)
npm test               # Executa suíte de testes unitários (25 testes)

# Compilação e Empacotamento de Bundles (NCC)
npm run build:changelog # Compila src/actions/changelog.ts -> dist/changelog/index.js
npm run build:release   # Compila src/actions/release.ts -> dist/release/index.js
npm run build           # Compila todos os bundles de actions para dist/
```

---

## 🏛️ Topologia do Repositório

```text
gh-workflows/
├── .agents/                    # Governança, memória de IA e especificações
│   ├── CONTEXT.md              # [Este arquivo] Visão executiva e técnica do projeto
│   ├── AGENTS.md               # Regras de ouro, restrições e convenções para assistentes
│   ├── DATA.md                 # Mapeamento de entidades, dados e integrações externas
│   ├── TASKS.md                # Backlog estruturado de tarefas e débito técnico
│   └── specs/                  # Especificações funcionais (REQUIREMENTS.md SRS 2.0.0)
├── .github/
│   └── workflows/              # Workflows de CI interno e Reusable Workflows públicos
│       ├── cd-release.yml      # Reusable Workflow para releases e changelog
│       ├── ci.yml              # CI interno de testes, build e auto-commit de dist/
│       ├── changelog.yml       # Workflow interno para disparo avulso do changelog
│       └── release.yml         # Workflow interno para teste da action de release
├── actions/                    # Composite/Custom Action definitions (metadados públicos)
│   ├── changelog/              # Definição action.yml da engine de Changelog
│   └── release/                # Definição action.yml da engine de Release
├── dist/                       # Bundles minificados gerados pelo NCC (versionados no Git)
│   ├── changelog/index.js      # Bundle autocontido de changelog
│   └── release/index.js        # Bundle autocontido de release
├── src/                        # Código-fonte principal em TypeScript
│   ├── actions/                # Entrypoints executáveis das GitHub Actions
│   │   ├── changelog.ts        # Lógica de atualização e parsing de CHANGELOG.md
│   │   └── release.ts          # Lógica de cálculo SemVer e GitHub Releases
│   ├── core/                   # Módulos de domínio, utilitários e infraestrutura
│   │   ├── commits.ts          # Parser de Conventional Commits e agrupador de notas
│   │   ├── exec.ts             # Wrapper resiliente para @actions/exec
│   │   ├── git.ts              # Comandos Git de tags, commits, delimitadores e bot
│   │   ├── github.ts           # Cliente Octokit autenticado e utilitários de PR
│   │   ├── index.ts            # Barrel export da camada core
│   │   ├── io.ts               # Encapsulamento de inputs, outputs e summaries
│   │   ├── logger.ts           # Logger padronizado com prefixos visuais e grupos
│   │   └── template.ts         # Interpolador de templates Markdown (com datas dinâmicas)
│   └── types/                  # Contratos de tipos TypeScript compartilhados
│       └── index.ts            # Tipos BumpType e ParsedCommit
├── templates/                  # Templates Markdown para GitHub Job Summaries
│   ├── summary-changelog.md    # Template de resumo de atualização de changelog
│   ├── summary-release-*.md    # Templates de resumo para releases publicadas/puladas
├── tests/                      # Suíte de testes automatizados com Vitest
│   ├── changelog.test.ts       # Testes da engine de changelog e regex de seções
│   ├── release.test.ts         # Testes de cálculo de SemVer e detecção de branches
│   └── templates.test.ts       # Testes de interpolação e fallbacks de template
└── docs/                       # Documentação técnica e ADRs
    └── adrs/                   # Architecture Decision Records
```

---

## 🔄 Catálogo de Workflows e Actions

### 1. Workflows Reutilizáveis (`workflow_call`)
- **`cd-release.yml`**: Orquestra a geração de Git Tag, criação de GitHub Release oficial e atualização do `CHANGELOG.md` em repositórios consumidores sem necessidade de scripts ou dependências externas no consumidor.

### 2. Actions Locais (`actions/`)
- **`actions/release`**: Inspeciona commits desde a última tag, calcula incremento SemVer (`major`, `minor`, `patch`), cria Git Tag anotada e publica Release no GitHub via Octokit.
- **`actions/changelog`**: Extrai notas estruturadas por tipo de commit, gerencia o ciclo da seção `## [Unreleased]` ou consolida uma versão datada definitiva em `CHANGELOG.md`, realizando auto-commit com identidade oficial de bot.
