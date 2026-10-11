# 📋 Especificação de Requisitos de Software (SRS) — Reusable Workflows

**Versão:** 2.0.0 (TypeScript Architecture)  
**Data:** 2026-10-09  
**Status:** Aprovado  
**Público-alvo:** Arquitetos, Mantenedores, Agentes de IA e Desenvolvedores de CI/CD  

---

## 1. Visão Geral (Overview)

### 1.1 Objetivo do Produto
Fornecer um conjunto opinativo e agnóstico de **GitHub Actions e Reusable Workflows** para automação de esteiras de Integração Contínua (CI) e Entrega Contínua (CD). O sistema deve permitir que repositórios consumidores adotem padrões rigorosos de qualidade, governança de branches, versionamento semântico, geração de changelog e publicação de pacotes com configuração mínima (inferior a 5 minutos) e **zero complexidade de scripts locais**.

### 1.2 Escopo do Produto
- **Dentro do Escopo:**
  1. Orquestração completa de Pull Requests automáticos e promoção de branches (`cd-pull-request.yml`).
  2. Execução de testes unitários e cálculo normalizado de cobertura de código (Quality Gate).
  3. Geração de notas de release e ciclo de vida do arquivo `CHANGELOG.md` com suporte a `[Unreleased]` (`changelog.yml` / `cd-release.yml`).
  4. Cálculo automatizado de incremento SemVer (Major, Minor, Patch) baseado em Conventional Commits e publicação de GitHub Releases oficiais.
  5. Wrapper especializado para pipelines baseados na ferramenta `semantic-release` (`cd-semantic-release.yml`).
  6. Publicação paralela de artefatos em múltiplos registries (NPM, GitHub Packages, PyPI, Packagist, NuGet) (`cd-publish.yml`).
  7. Suporte nativo a múltiplos projetos mono e multi-stack (Node.js, PHP, .NET, Python, Go).
- **Fora do Escopo:**
  - Provisionamento de infraestrutura de nuvem (Terraform, AWS, GCP, Azure).
  - Deploy em servidores de aplicação (Kubernetes, ECS, VPS) — o foco é entrega de código/pacotes.
  - Substituição de linters ou SAST de terceiros (ex: SonarQube).

---

## 2. Premissas e Princípios Arquiteturais

1. **Zero Overhead de Instalação no Consumidor (Boot < 1s):**
   - Repositórios consumidores **NUNCA** devem aguardar `npm install` das ferramentas internas da biblioteca no início da pipeline. Todos os executáveis devem estar pré-compilados em bundles autocontidos (`dist/*.js`).
2. **Fachada Pública Simplificada (Reusable Workflows First):**
   - Os desenvolvedores consumidores interagem **apenas** com os Reusable Workflows de alto nível localizados em `.github/workflows/`. As ações internas (`detect-stack`, `run-coverage`, etc.) são blocos de construção internos (Building Blocks).
3. **Imutabilidade e Transparência Multiplataforma:**
   - Todas as lógicas internas operam em **Node 20 nativo** com bibliotecas oficiais do GitHub (`@actions/core`, `@actions/github`, `@actions/exec`). Nenhuma operação deve falhar por diferenças de shell (Windows PowerShell vs Linux Bash) ou quebras de linha (`CRLF` vs `LF`).
4. **Governança Estrita por Conventional Commits:**
   - Versionamento Semântico e changelogs são derivados exclusivamente da convenção [Conventional Commits 1.0.0](https://www.conventionalcommits.org/).

---

## 3. Restrições Técnicas

1. **Ambiente de Execução (Runtime):**
   - GitHub Actions Runners (`ubuntu-latest`, com Node.js 20 LTS pré-instalado).
2. **Empacotador Oficial:**
   - `@vercel/ncc` deve compilar cada entrypoint TypeScript de `src/actions/` para um arquivo único e minificado em `dist/<action>/index.js`, embutindo todas as dependências (`node_modules`).
3. **Versionamento de Artefatos Compilados (`dist/`):**
   - A pasta `dist/` **deve ser versionada no repositório Git**, permitindo que o runner execute a ação imediatamente sem passo de compilação em runtime.
4. **Segurança e Privilégios (Permissions):**
   - Mínimo privilégio por padrão (`contents: read`).
   - Permissões de escrita (`contents: write`, `pull-requests: write`, `packages: write`) devem ser declaradas explicitamente nos workflows ou delegadas via secrets (`GH_TOKEN`).
5. **Codificação e Padrões:**
   - Todos os arquivos devem seguir codificação **UTF-8 sem BOM**.
   - Preservação estrita dos templates Markdown canônicos na pasta `templates/`.

---

## 4. Requisitos Funcionais (RF)

### [RF01] Detecção Automática de Stack (`detect-stack`)
- **RF01.1:** O sistema deve identificar automaticamente a tecnologia do projeto através de manifestos na raiz:
  - Node.js: `package.json`, `yarn.lock`, `pnpm-lock.yaml`.
  - PHP: `composer.json`, `index.php`.
  - .NET: `*.csproj`, `*.sln`.
  - Python: `requirements.txt`, `pyproject.toml`, `Pipfile`, `uv.lock`, `setup.py`.
  - Go: `go.mod`.
- **RF01.2:** Se a raiz não contiver manifestos, o sistema deve inspecionar o primeiro nível de subdiretórios (ignorando `node_modules`, `vendor`, `.git`). Se encontrar um único subdiretório com projeto, deve auto-detectá-lo.
- **RF01.3:** Permitir override explícito via input `stack`.
- **RF01.4:** Em caso de falha de detecção, emitir um GitHub Job Summary formatado com dicas de correção (`summary-detect-stack-error.md`).

### [RF02] Quality Gate de Testes e Cobertura (`run-tests` & `run-coverage`)
- **RF02.1:** Executar a suíte de testes unitários conforme a stack detectada ou comando customizado (`test-command`).
- **RF02.2:** Normalizar a cobertura apurada para o contrato JSON padrão:
  `coverage/coverage-summary.normalized.json` com campos `line`, `min`, `status`, `mode`, `base_line`.
- **RF02.3:** Suportar três modos de avaliação (`coverage-mode`):
  - `block`: Bloqueia e falha o pipeline se `line < coverage-min`.
  - `info`: Registra anotação de aviso (`warning`), mas não falha a esteira se abaixo da meta.
  - `decrease`: Bloqueia o pipeline se a cobertura atual for inferior à cobertura aprovada na branch base (`base_line`).
- **RF02.4:** Permitir dispensar o Quality Gate via input `skip-quality-gate: true` no workflow de Pull Request.

### [RF03] Orquestração de Promoção de Branches e Pull Requests (`create-pr` & `cd-pull-request.yml`)
- **RF03.1:** Determinar dinamicamente a branch de destino (`base`) conforme a estratégia configurada:
  - `trunk`: `feature/**` ou `fix/**` → `main`.
  - `develop`: `feature/**` → `develop`. Ao integrar em `develop`, avalia se gera versão e promove para `main`.
  - `gitflow`: `develop` → branch de release (`release-x.y.z`) → `main`.
- **RF03.2:** Avaliar automaticamente o histórico Git entre `${BASE}..${HEAD}` e preencher os checkboxes do corpo do PR:
  - Confirmação de testes passados.
  - Detecção de documentação (`.md`, `docs/`, `README`).
  - Tipo de mudança (Features `feat:`, Correções `fix:`, Quebras `BREAKING CHANGE:`, Refatorações `refactor:`/`perf:`).
- **RF03.3:** Gerenciar labels automáticas no PR via Octokit: `auto-generated`, `coverage-passed`, `coverage-failed`, `coverage-missing`.
- **RF03.4:** Se o PR já existir aberto entre `head` e `base`, atualizá-lo atomicamente (título, corpo, labels) sem duplicar PRs.
- **RF03.5:** Se não houver novos commits de diferença entre as branches, realizar skip gracioso (`pr_action=skipped`) emitindo aviso amigável no Step Summary.

### [RF04] Geração Inteligente de Changelog (`changelog`)
- **RF04.1:** Extrair commits desde a última Git Tag estável (`v*`) e classificá-los por categoria:
  - 💥 Breaking Changes
  - 🚀 Features (`feat:`)
  - 🐛 Bug Fixes (`fix:`)
  - ⚡ Performance Improvements (`perf:`)
  - ♻️ Code Refactoring (`refactor:`)
  - 📝 Documentation (`docs:`)
  - ✅ Tests (`test:`)
  - 👷 CI & Build System (`ci:`, `build:`)
  - 🔧 Miscellaneous (`chore:`)
  - ⏪ Reverts (`revert:`)
- **RF04.2:** Filtrar commits ruído (merges, bumps automáticos de release, commits com `[skip ci]`).
- **RF04.3:** Ciclo de vida da seção `## [Unreleased]`:
  - Em branches de desenvolvimento (`develop`): atualiza ou insere atomicamente a seção `## [Unreleased]`.
  - Em branches de release (`main`): converte o conteúdo de `[Unreleased]` para uma versão datada definitiva `## [vX.Y.Z] - YYYY-MM-DD`.
- **RF04.4:** Realizar commit automático do arquivo `CHANGELOG.md` com mensagem parametrizável e `[skip ci]`.

### [RF05] Versionamento Semântico e Releases Oficiais (`release` & `cd-release.yml`)
- **RF05.1:** Analisar o histórico de commits e calcular o incremento SemVer estrito:
  - `BREAKING CHANGE:` ou `!` no tipo → **Major** (`1.0.0` → `2.0.0`).
  - `feat:` → **Minor** (`1.0.0` → `1.1.0`).
  - `fix:`, `perf:`, `revert:` → **Patch** (`1.0.0` → `1.0.1`).
  - `docs:`, `chore:`, `ci:`, `test:`, `refactor:` → **Nenhum bump** (sem release).
- **RF05.2:** Suportar pre-releases incrementais em branches correspondentes a `release-*,release/*` (ex: `v1.1.0-rc.1`).
- **RF05.3:** Criar Git Tag anotada no repositório e publicar uma **GitHub Release oficial** via Octokit REST API com as notas formatadas e links para commits.
- **RF05.4:** Permitir desativar a geração de changelog via input `enable-changelog: false`.

### [RF06] Publicação Multi-Registry Agnóstica (`publish` & `cd-publish.yml`)
- **RF06.1:** Suportar publicação paralela via matriz para múltiplos registries (ex: `registries: "npm, github"`).
- **RF06.2:** Configurar dinamicamente o arquivo de autenticação `.npmrc` com backup e limpeza automática no encerramento do step.
- **RF06.3:** Suporte a modo simulação (`dry-run: true`) que executa `npm publish --dry-run` sem enviar artefatos.
- **RF06.4:** Renderizar tabela consolidada com status de publicação por registry no GitHub Step Summary.

---

## 5. Requisitos Não-Funcionais (RNF)

- **[RNF01] Desempenho e Velocidade de Boot:**
  Cada action Node.js deve inicializar em menos de 1 segundo em runners Linux. O tempo total de execução das actions atômicas não deve exceder 5 segundos (excluindo o tempo de instalação de dependências do próprio projeto consumidor).
- **[RNF02] Isolamento de Módulos (Zero Dependência Externa em Runtime):**
  Todos os pacotes npm necessários (`@actions/core`, `@actions/github`, `semver`) devem estar embutidos no bundle compilado via `ncc`.
- **[RNF03] Testabilidade e Confiabilidade:**
  100% da lógica de negócio e regras condicionais devem ser cobertas por testes automatizados executados pelo **Vitest**, com tempo total de execução da suíte inferior a 5 segundos.
- **[RNF04] Compatibilidade Multiplataforma:**
  O desenvolvimento e a execução de testes da biblioteca devem funcionar de forma idêntica em ambientes Windows (PowerShell), macOS e Linux.
- **[RNF05] Idempotência:**
  A execução repetida dos workflows e actions em estados idênticos de branch ou commits não deve gerar tags duplicadas, PRs redundantes ou commits corrompidos.

---

## 6. Contratos de Interface dos Workflows Públicos (Reusable Workflows)

### 6.1 `cd-pull-request.yml`
```yaml
uses: heliomarpm/reusable-workflows/.github/workflows/cd-pull-request.yml@main
with:
  strategy: 'trunk' # trunk | develop | gitflow
  project-path: '.'
  coverage-min: 80
  coverage-mode: 'block' # block | info | decrease
  skip-quality-gate: false
secrets:
  GH_TOKEN: ${{ secrets.PAT_TOKEN }}
```

### 6.2 `cd-release.yml`
```yaml
uses: heliomarpm/reusable-workflows/.github/workflows/cd-release.yml@main
with:
  enable-changelog: true
  project-path: '.'
  prerelease-incremental: true
secrets:
  GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 6.3 `cd-semantic-release.yml`
```yaml
uses: heliomarpm/reusable-workflows/.github/workflows/cd-semantic-release.yml@main
with:
  skip-version-file: false
  skip-changelog: false
  dry-run: false
secrets:
  GH_TOKEN: ${{ secrets.GH_TOKEN }}
```

### 6.4 `cd-publish.yml`
```yaml
uses: heliomarpm/reusable-workflows/.github/workflows/cd-publish.yml@main
with:
  registries: 'npm, github'
  dry-run: false
secrets:
  NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
  GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 7. Critérios de Aceite (Definition of Done — BDD)

- **Cenário 1: Novo recurso adicionado em branch de release**
  - **Given** que o repositório está na branch `main` com tag anterior `v1.0.0`
  - **When** um commit com mensagem `feat(auth): novo fluxo de login` é enviado
  - **Then** a action `release` deve calcular a próxima versão como `v1.1.0` (minor)
  - **And** deve criar a tag `v1.1.0` e publicar uma GitHub Release com a nota formatada.

- **Cenário 2: Commits sem impacto em SemVer**
  - **Given** que foram adicionados apenas commits do tipo `docs:` e `chore:`
  - **When** a action `release` for executada
  - **Then** `has-changes` deve ser `false`
  - **And** nenhuma tag ou release deve ser gerada, encerrando com sucesso.

- **Cenário 3: Quality Gate no modo block com cobertura insuficiente**
  - **Given** que a meta mínima de cobertura é de 80% no modo `block`
  - **When** os testes gerarem cobertura de 70%
  - **Then** a action `run-coverage` deve registrar o erro e falhar a pipeline com código 1
  - **And** deve gerar anotação no Step Summary indicando o motivo do bloqueio.
