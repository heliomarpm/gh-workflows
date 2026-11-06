<div id="top" align="center">
  <h1>🚀 Reusable Workflows — CI/CD Sem Boilerplate no GitHub Actions <a href="https://navto.me/heliomarpm" target="_blank"><img src="https://navto.me/assets/navigatetome-brand.png" width="32"/></a></h1>

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-CI%2FCD-2088FF.svg?logo=githubactions&logoColor=white)](https://github.com/features/actions)
  [![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://conventionalcommits.org)
  [![Node.js](https://img.shields.io/badge/Node.js-18%20|%2020%20|%2022-brightgreen.svg?logo=node.js)](https://nodejs.org)
  [![PHP](https://img.shields.io/badge/PHP-8.1%20|%208.2%20|%208.3-8892BF.svg?logo=php&logoColor=white)](https://php.net)


  <div class="badges">

  [![GitHub Sponsors][url-github-sponsors-badge]][url-github-sponsors]
  [![PayPal][url-paypal-badge]][url-paypal]
  [![Ko-fi][url-kofi-badge]][url-kofi]
  [![Liberapay][url-liberapay-badge]][url-liberapay]
    
  </div>
</div>

**Reusable Workflows** é um conjunto opinativo de **Reusable Workflows** e **Composite Actions** projetado para padronizar e acelerar esteiras de integração contínua (CI), controle de qualidade, promoção automática de branches e releases no GitHub Actions.

Com apenas algumas linhas de YAML, qualquer repositório herda:
- 🧪 **Quality Gate determinístico**: execução de testes e validação rigorosa de cobertura mínima.
- 🔀 **Promoção Automática de Branches (Auto PR)**: suporte nativo a estratégias **Trunk-Based**, **Develop** e **GitFlow** (com suporte a hotfixes emergenciais).
- 🏷️ **Releases e Changelog Automatizados**: versionamento semântico determinístico com zero dependências externas.
- 📦 **Publicação Multi-Registry**: publicação simultânea de pacotes para múltiplos registries (ex: `npm` e `GitHub Packages` no mesmo ciclo).

## 🧠 Filosofia

> "Automação sem disciplina cria caos. \
> Disciplina sem automação não escala."

---

## 📣 Por que isso existe

A maioria dos repositórios começa simples e gradualmente acumula complexidade operacional:

- Pipelines de CI inconsistentes
- Releases manuais
- Versionamento não confiável
- Regras de promoção de branches pouco claras
- Verificações de qualidade aplicadas tardiamente

Grandes empresas resolvem isso com equipes de engenharia de plataforma.

Equipes pequenas e desenvolvedores individuais geralmente não conseguem.

Este projeto codifica um modelo mínimo de engenharia de plataforma em fluxos de trabalho reutilizáveis para que cada repositório possa começar com práticas de engenharia previsíveis desde o primeiro dia.

### O que este projeto é

Uma plataforma de fluxo de trabalho reutilizável que fornece:

- Releases determinísticos
- Controles de qualidade rigorosos
- Estratégia de promoção consistente
- Governança de commits convencional
- Execução agnóstica à stack de tecnologias

Você adiciona fluxos de trabalho.

Você herda a disciplina de engenharia.

---

## O que este projeto NÃO é

- um kit de ferramentas de CI genérico
- um repositório de modelos
- um framework DevOps completo
- pipelines infinitamente configuráveis

O projeto é intencionalmente opinativo.

Os valores padrão fazem parte do seu valor.

--- 

## ⚡ Quick Start em 3 Minutos

Para habilitar a esteira completa no seu repositório consumidor, crie os dois arquivos abaixo na pasta `.github/workflows/`:

### 1. `.github/workflows/ci-pr.yml` — CI & Promoção Automática
Executa testes, calcula a cobertura e, em caso de sucesso, abre ou atualiza automaticamente o Pull Request de acordo com o fluxo do seu time:

```yaml
name: "1. CI & Auto PR"

on:
  push:
    branches: ["develop", "feature/**", "hotfix/**", "release-*"]

permissions:
  contents: write
  pull-requests: write

jobs:
  ci-pr:
    uses: heliomarpm/reusable-workflows/.github/workflows/cd-pull-request.yml@main
    with:
      strategy: develop      # Opções: trunk | develop | gitflow
      # skip-quality-gate: false # Opcional: ignore testes e validação de cobertura
      coverage-min: 80
      coverage-mode: block   # 'block' falha a PR se cobertura < 80%. 'info' apenas alerta.
    secrets:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 2. `.github/workflows/release.yml` — Criação da Release
Gera a Git Tag, notas categorizadas e atualiza o `CHANGELOG.md` automaticamente ao integrar na branch principal:

```yaml
name: "3. Release"

on:
  push:
    branches: [main]
    paths-ignore:
      - 'CHANGELOG.md'

permissions:
  contents: write

jobs:
  release:
    uses: heliomarpm/reusable-workflows/.github/workflows/cd-release.yml@main
    with:
      enable-changelog: true
      version-format: "v%major.%minor.%patch"
    secrets:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## ⚙️ Pré-requisitos & Permissões no GitHub

Para que o GitHub Actions possa criar Pull Requests, enviar tags, gerar releases ou publicar pacotes, configure as permissões no repositório consumidor:

### 1. Configuração do Repositório (Settings)
1. Acesse **Settings > Actions > General > Workflow permissions**.
2. Selecione **Read and write permissions** (permite que o `GITHUB_TOKEN` crie tags, commits e releases).
3. Marque a caixa **Allow GitHub Actions to create and approve pull requests** (essencial para o Auto PR).
4. Clique em **Save**.

### 2. Declaração Obrigatória de Permissões no Workflow Chamador (`permissions`)
No GitHub Actions, um **Reusable Workflow (`workflow_call`)** só pode executar com permissões que foram explicitamente concedidas pelo workflow chamador (*caller workflow*). Caso o chamador não defina `permissions:`, o GitHub aplica o perfil restritivo padrão (`contents: read`), resultando em erro de validação estática.

Sempre declare o bloco `permissions:` no início do seu workflow chamador ou no nível do job:

| Reusable Workflow | Permissões Mínimas no Chamador | Motivo Técnico |
| :--- | :--- | :--- |
| **`cd-release.yml`** | `contents: write` | Criar tags Git, comitar `CHANGELOG.md` e publicar a GitHub Release. |
| **`cd-semantic-release.yml`** | `contents: write`<br>`issues: write`<br>`pull-requests: write` | Criar tags/releases, comitar mudanças e notificar issues e PRs associados à release. |
| **`cd-pull-request.yml`** | `contents: write`<br>`pull-requests: write` | Criar/atualizar Pull Requests e criar branches remotas de release se inexistentes. |
| **`cd-publish.yml`** | `contents: read`<br>`packages: write` | Ler código para empacotamento e publicar no GitHub Packages (quando utilizado). |
| **`cd-rollback.yml`** | `contents: write`<br>`issues: write` | Reverter commits, publicar releases de correção (patch), excluir tags e gerenciar issues de rollback. |

---

## 🏗️ Estratégias de Promoção de Branches

O workflow `cd-pull-request.yml` gerencia o ciclo de vida dos Pull Requests de acordo com a estratégia informada no input `strategy`:

| Estratégia | Fluxo de Promoção | Quando abre o PR de Release |
| :--- | :--- | :--- |
| **`trunk`** | `feature/**` → `main` | Imediatamente a cada push aprovado no CI |
| **`develop`** | `feature/**` → `develop` → `main` | Apenas quando há commits que alteram a versão |
| **`gitflow`** | `feature/**` → `develop` → `release-x.y.z` → `main` | Apenas quando há commits que alteram a versão |
| **`hotfix`** | `hotfix/**` → `main` | Sempre (override imediato para correção emergencial) |

> [!TIP]
> **Para que o GitFlow funcione em cascata de ponta a ponta:**  
> Certifique-se de que o workflow de CI (`Quality Assurance`) do repositório consumidor inclua a branch de release nos gatilhos de `push` (ex: `branches: ["develop", "feature/**", "hotfix/**", "release-*"]`).  
> Assim, ao mesclar a PR de `develop` para `release-x.y.z`, o CI será executado na branch de release e o workflow de Auto PR abrirá automaticamente a PR final da release para `main`.

### 🔥 Hotfix (O Override Controlado)
Branches prefixadas com `hotfix/*` são tratadas como exceção arquitetural controlada: **sempre abrem PR diretamente para a branch principal (`main`)**, ignorando a branch de desenvolvimento para garantir correção imediata de incidentes em produção.

---

## 📦 Catálogo de Reusable Workflows

### 1️⃣ CD — Promoção Automática de Branches (`cd-pull-request.yml`)

Abre ou atualiza Pull Requests automaticamente, injetando o laudo de cobertura e métricas diretamente no corpo do PR.

```yaml
permissions:
  contents: write
  pull-requests: write

jobs:
  promote:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    uses: heliomarpm/reusable-workflows/.github/workflows/cd-pull-request.yml@main
    with:
      strategy: develop                    # Opcional: trunk | develop (default) | gitflow
      main-branch: 'main'                  # Opcional: Nome da branch principal (default: main)
      develop-branch: 'develop'            # Opcional: Nome da branch de integração (default: develop)
      prefix-release-branch: 'release-'    # Opcional: Prefixo usado no GitFlow (ex: release-1.2.0)
      pr-title: '🔀 PR ({{yyyy-MM-dd}}): {{HEAD_BRANCH}} → {{BASE_BRANCH}}'   # Opcional

      # Quality Gate (CI Quality Gate)
      stack: ''            # Opcional: 'node' ou 'php' (vazio = auto-detect)
      project-path: '.'    # Opcional: caminho do código (para monorepos/subpastas)
      test-command: ''     # Opcional: comando customizado para testes (ex: 'npm test', 'pytest') (default: padrão da stack)
      skip-quality-gate: false # Opcional: ignora testes e validação de cobertura (default: false)
      coverage-min: 80     # Opcional: Porcentagem mínima de cobertura exigida (default: 80)
      coverage-mode: block # Opcional: 'block' (falha o job) | 'info' (alerta) | 'decrease' (bloqueia queda) (default: info)
      
    secrets:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### 🛡️ Modos de Avaliação e Opções do Quality Gate:
- **`test-command`**: Permite definir um comando customizado para executar a suíte de testes (ex: `npm run test:unit`, `pnpm test`, `pytest`, `./vendor/bin/pest`). Se omitido, utiliza a engine padrão da stack detectada (ex: `npm test` para Node, `phpunit`/`pest` para PHP).
- **`skip-quality-gate: true`**: Ignora completamente os testes e a verificação de cobertura (inclusive bloqueios de `coverage-mode: block`), avançando diretamente para a abertura/atualização do Pull Request e registrando o bypass no resumo (`GITHUB_STEP_SUMMARY`) e no corpo do PR.
- **`block`**: Se a cobertura ficar abaixo de `coverage-min`, o job falha com erro vermelho. Como o Auto PR depende do sucesso do CI, o PR **não é aberto**.
- **`info`**: O CI sempre conclui com sucesso, mas anexa a etiqueta `coverage-failed` (se abaixo da meta) e a tabela detalhada de cobertura no PR para os revisores.
- **`decrease`**: Compara com a cobertura da branch de destino e impede regressões.

> [!TIP]
> **Título Personalizado na Aba Actions (`run-name`):**  
> Para exibir exatamente as branches de origem e destino na lista de execuções do GitHub Actions:
> ```yaml
> run-name: "🔀 Auto PR: ${{ github.event.workflow_run.head_branch }} → ${{ github.event.workflow_run.head_branch == 'develop' && 'main' || 'develop' }}"
> ```
>
> Revise a documentação para mais detalhes.


---

### 2️⃣ CD — Release Nativa & Zero-Dependency (`cd-release.yml`)

Engine ultra-rápida (< 2 segundos) para criação de **Git Tag**, **GitHub Release** e atualização opcional do `CHANGELOG.md` sem necessidade de Node.js, `npm install` ou ferramentas externas. Segue as mesmas regras de SemVer e Conventional Commits do Semantic Release (veja a tabela abaixo):

```yaml
permissions:
  contents: write

jobs:
  release:
    uses: heliomarpm/reusable-workflows/.github/workflows/cd-release.yml@main
    with:
      enable-changelog: true                  # Opcional (default: true): atualiza o CHANGELOG.md
      changelog-title: "# 📦 Changelog\n\nAll notable changes to this project will be documented in this file." # Opcional: título/cabeçalho inicial
      version-format: "v%major.%minor.%patch" # Opcional: "v%major.%minor.%patch" ou "%YYYY-%mm-%dd"
      changelog-file: "CHANGELOG.md"          # Caminho do arquivo de changelog
      prerelease-incremental: true            # Opcional (default: true): tags incrementais (v1.0.0-rc.1) | false para mesma tag final (v1.0.0)
      prerelease-suffix: 'rc'                 # Opcional (default: 'rc'): sufixo de pré-release quando incremental for true
    secrets:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

> [!NOTE]
> **Modos de Pré-Release em Branches `release-*`:**  
> - **`prerelease-incremental: true` (Padrão / Recomendado)**: Na branch de release gera tags incrementais (`v1.0.0-rc.1`, `v1.0.0-rc.2`, etc.) marcadas como Pre-Release no GitHub. Ao fazer merge na `main`, publica a tag final limpa (`v1.0.0`) classificada como **Latest**.
> - **`prerelease-incremental: false`**: Na branch de release gera a tag de destino final (`v1.0.0`) marcada como Pre-Release no GitHub. Ao fazer merge na `main`, essa mesma release é promovida para **Latest** (`prerelease: false`).

---

### 3️⃣ CD — Semantic Release (`cd-semantic-release.yml`)

Para projetos que necessitam do ecossistema de plugins do `semantic-release` (análise avançada de commits, plugins npm, etc.):

```yaml
permissions:
  contents: write
  issues: write
  pull-requests: write

jobs:
  release:
    uses: heliomarpm/reusable-workflows/.github/workflows/cd-semantic-release.yml@main
    with:
      project-path: '.'                       # Subpasta onde está o código (opcional)
      changelog-title: "# 📦 Changelog\n\nAll notable changes to this project will be documented in this file." # Opcional: cabeçalho inicial do CHANGELOG.md
      skip-version-file: false                # Opcional (default: false): não altera a versão em package.json, composer.json, etc.
      skip-changelog: false                   # Opcional (default: false): não gera nem comita CHANGELOG.md
      prerelease-incremental: true            # Opcional (default: true): tags incrementais (v1.0.0-rc.1) | false para mesma tag final (v1.0.0)
      prerelease-suffix: 'rc'                 # Opcional (default: 'rc'): sufixo de pré-release quando incremental for true
    secrets:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

### 4️⃣ CD — Publish Multi-Registry (`cd-publish.yml`)

Publicação automatizada e agnóstica de pacotes para **um ou múltiplos registries simultâneos**, com suporte a Node.js (`npm`), PHP (`Packagist`) ou comandos customizados:

```yaml
name: "4. Publish"

on:
  release:
    types: [published]
  workflow_dispatch:
    inputs:
      dry-run:
        type: boolean
        default: false

permissions:
  contents: read
  packages: write

jobs:
  publish:
    uses: heliomarpm/reusable-workflows/.github/workflows/cd-publish.yml@main
    with:
      registries: 'npm, github' # Publica no npmjs.org e no GitHub Packages ao mesmo tempo!
      dry-run: ${{ inputs.dry-run || false }}
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

### 5️⃣ CD — Rollback Controlado & Multi-Estratégia (`cd-rollback.yml`)

Permite desarmar incidentes de produção com rapidez e segurança, revertendo código com roll-forward SemVer (`revert`), identificando versões estáveis para redeploy downstream (`redeploy`), ou expurgando releases defeituosas (`delete-tag`).

Suporta acionamento manual pela interface do GitHub Actions (`workflow_dispatch`) e orientado a eventos via abertura de issues (`issues: [opened]`), com validação rigorosa de privilégios de colaborador (`write` ou `admin`).

#### Exemplo 1: Reusable Workflow para Acionamento Manual (`.github/workflows/rollback.yml`)

Permite que os operadores realizem o rollback com um clique na aba **Actions**:

```yaml
name: "5. Rollback"

on:
  workflow_dispatch:
    inputs:
      strategy:
        description: 'Estratégia de rollback'
        type: choice
        options:
          - revert
          - redeploy
          - delete-tag
        default: 'revert'
      target-version:
        description: 'Versão/tag alvo ou commit a reverter (vazio para fallback automático)'
        type: string
        default: ''
      allow-destructive:
        description: 'Confirmar exclusão de tag (obrigatório se strategy = delete-tag)'
        type: boolean
        default: false
      dry-run:
        description: 'Simular operação sem aplicar alterações'
        type: boolean
        default: false

permissions:
  contents: write
  issues: write

jobs:
  rollback:
    uses: heliomarpm/gh-workflows/.github/workflows/cd-rollback.yml@main
    with:
      strategy: ${{ inputs.strategy }}
      target-version: ${{ inputs.target-version }}
      allow-destructive: ${{ inputs.allow-destructive }}
      dry-run: ${{ inputs.dry-run }}
    secrets:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### Exemplo 2: Acionamento via Abertura de Issue (`.github/workflows/issue-rollback.yml`)

Permite que membros autorizados da equipe solicitem rollbacks abrindo uma issue com a etiqueta `rollback`. Se o autor não tiver permissão de escrita, a action fecha a issue e recusa a operação:

```yaml
name: "Issue Ops - Rollback"

on:
  issues:
    types: [opened]

permissions:
  contents: write
  issues: write

jobs:
  rollback:
    if: contains(github.event.issue.labels.*.name, 'rollback')
    runs-on: ubuntu-latest
    steps:
      - name: 📌 Checkout repository
        uses: actions/checkout@v7
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: ⏪ Rollback Engine
        uses: heliomarpm/gh-workflows/actions/rollback@main
        with:
          strategy: 'revert'
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

#### 🛡️ Estratégias Suportadas:
- **`revert` (Padrão / Recomendado)**: Roll-forward seguro. Executa `git revert` no intervalo de commits correspondente à release com problema, realiza commit assinado por `github-actions[bot]`, lança uma nova release SemVer patch (ex: `v1.0.1` → `v1.0.2`) e documenta o resumo da operação. Caso haja conflito de merge, o mecanismo aplica **Fail-Fast** e publica um guia de resolução manual no Job Summary.
- **`redeploy`**: Não modifica o repositório Git nem tags. Localiza o alvo anterior estável e exporta os outputs (`target_version`, `target_commit`, `rollback_strategy`), permitindo que jobs posteriores disparem o redeploy da versão antiga.
- **`delete-tag`**: Expurgo destrutivo. Remove a tag Git local e remota e deleta a Release correspondente no GitHub. Exige explicitamente `allow-destructive: true`.

> [!TIP]
> **Cascata Automática de Resolução de Alvo:**  
> Caso o input `target-version` seja omitido, a action busca automaticamente a **última release/tag estável anterior**. Em repositórios novos que ainda não possuem tags, o mecanismo faz fallback seguro para o commit imediatamente anterior (`HEAD~1`).


---

## 🔒 Conventional Commits & Impacto nas Releases

O versionamento segue a especificação de [Conventional Commits](https://www.conventionalcommits.org/):

| Prefixo do Commit | Dispara Nova Release? | Impacto no SemVer | Exemplo |
| :--- | :---: | :---: | :--- |
| `feat:` | ✅ **Sim** | `minor` | `1.0.0` → `1.1.0` |
| `fix:` | ✅ **Sim** | `patch` | `1.0.0` → `1.0.1` |
| `perf:` | ✅ **Sim** | `patch` | `1.0.0` → `1.0.1` |
| `revert:` | ✅ **Sim** | `patch` | `1.0.0` → `1.0.1` |
| `BREAKING CHANGE:` ou `!` no prefixo | ✅ **Sim** | `major` | `1.0.0` → `2.0.0` |
| `docs:` | ❌ Não | *(Nenhum)* | Apenas documentação |
| `chore:` | ❌ Não | *(Nenhum)* | Manutenção e dependências |
| `ci:` | ❌ Não | *(Nenhum)* | Ajustes de pipeline |
| `test:` | ❌ Não | *(Nenhum)* | Criação ou ajuste de testes |
| `refactor:` | ❌ Não | *(Nenhum)* | Refatoração interna sem quebra |

---

## 🔧 Composite Actions (Pipelines Customizados)

Se preferir montar seu próprio workflow passo a passo, utilize as ações atômicas da pasta `/actions`:

| Action | Descrição |
| :--- | :--- |
| `heliomarpm/reusable-workflows/actions/detect-stack@main` | Identifica a tecnologia do projeto (`node`, `php`, etc.). |
| `heliomarpm/reusable-workflows/actions/setup-runtime@main` | Configura versão e cache de dependências. |
| `heliomarpm/reusable-workflows/actions/run-tests@main` | Executa a suíte de testes unitários da stack. |
| `heliomarpm/reusable-workflows/actions/run-coverage@main` | Normaliza relatório de cobertura e valida metas mínimas. |
| `heliomarpm/reusable-workflows/actions/changelog@main` | Gera e comita exclusivamente o arquivo `CHANGELOG.md`. |
| `heliomarpm/reusable-workflows/actions/release@main` | Cria a Git Tag e publica a release oficial no GitHub. |
| `heliomarpm/reusable-workflows/actions/create-pr@main` | Cria ou atualiza Pull Requests via GitHub CLI. |
| `heliomarpm/reusable-workflows/actions/publish@main` | Publica artefatos em um ou múltiplos registries. |
| `heliomarpm/reusable-workflows/actions/semantic-release@main` | Wrapper otimizado para o runner do Semantic Release. |
| `heliomarpm/gh-workflows/actions/rollback@main` | Executa reversão de código (revert), expurgo ou redeploy seguro. |

### Exemplo de Uso Customizado:
```yaml
jobs:
  custom-ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - id: stack
        uses: heliomarpm/reusable-workflows/actions/detect-stack@main
      - uses: heliomarpm/reusable-workflows/actions/setup-runtime@main
        with:
          stack: ${{ steps.stack.outputs.stack }}
      - uses: heliomarpm/reusable-workflows/actions/run-coverage@main
        with:
          stack: ${{ steps.stack.outputs.stack }}
          coverage-min: 85
          coverage-mode: block
```

---

## 🧱 Stacks Suportadas

| Stack | Detecção Automática | Ferramentas Suportadas | Cobertura |
| :--- | :--- | :--- | :--- |
| **Node.js** | `package.json` | Jest, Vitest, NPM, Yarn, PNPM | LCOV (`lcov.info`) |
| **PHP** | `composer.json` | PHPUnit, Pest, Composer | Clover XML (`clover.xml`) |
| **.NET / C#** | `*.csproj`, `*.sln` | *Em desenvolvimento* | OpenCover / Cobertura |
| **Python** | `pyproject.toml`, `requirements.txt` | *Em desenvolvimento* | Coverage.py |
| **Go** | `go.mod` | *Em desenvolvimento* | Go Cover |

---

## 📚 Documentação Técnica Interna & Agentes

Para detalhes técnicos avançados, funcionamento dos parsers em Bash, tratamento de escopo no GitHub Packages e referências de arquitetura (ADRs), consulte a documentação dedicada:
- 📖 [Arquitetura Interna & Guias de Mantenedores](.agents/ARCHITECTURE.md)
- 🤖 [Contexto para Agentes de IA](.agents/CONTEXT.md)
- 📐 [Architecture Decision Records (ADRs)](docs/adrs)

---

## 🤝 Contribuições & Suporte

- Quer contribuir com uma nova stack ou melhoria? Veja nosso [Guia de Contribuição](docs/CONTRIBUTING.md).
- Precisa de ajuda ou encontrou um problema? Consulte nosso [Suporte](docs/SUPPORT.md) ou abra uma [Issue](https://github.com/heliomarpm/gh-workflows/issues).
- Leia o [Código de Conduta](docs/CODE_OF_CONDUCT.md).

Obrigado a todos que já contribuíram para o projeto!

<a href="https://github.com/heliomarpm/gh-workflows/graphs/contributors" target="_blank">
<img src="https://contrib.nn.ci/api?repo=heliomarpm/gh-workflows&no_bot=true" />
</a>

###### Criado com [contrib.nn](https://contrib.nn.ci/?repo=heliomarpm/gh-workflows&no_bot=true).

Dito isso, existem várias maneiras de contribuir para este projeto, como:

⭐ Marcando o repositório com uma estrela (star) \
🐞 Relatando bugs \
💡 Sugerindo funcionalidades \
🧾 Melhorando a documentação \
📢 Compartilhando este projeto e recomendando-o aos seus amigos

## 💵 Apoie o Projeto

Se você gosta do projeto, considere fazer uma doação ao desenvolvedor via GitHub Sponsors, Ko-fi, PayPal ou Liberapay — a escolha é sua. 😉

<div class="badges">

  [![GitHub Sponsors][url-github-sponsors-badge]][url-github-sponsors]
  [![PayPal][url-paypal-badge]][url-paypal]
  [![Ko-fi][url-kofi-badge]][url-kofi]
  [![Liberapay][url-liberapay-badge]][url-liberapay]

</div>

## 📝 Licença

Distribuído sob a licença [MIT](LICENSE) © [Heliomar P. Marques](https://github.com/heliomarpm). <a href="#top">🔝</a>


----
<!-- Sponsor badges -->

[url-github-sponsors]: https://github.com/sponsors/heliomarpm
[url-github-sponsors-badge]: https://img.shields.io/badge/GitHub%20-Sponsor-1C1E26?style=for-the-badge&labelColor=1C1E26&color=db61a2
[url-kofi]: https://ko-fi.com/heliomarpm
[url-kofi-badge]: https://img.shields.io/badge/kofi-1C1E26?style=for-the-badge&labelColor=1C1E26&color=ff5f5f
[url-liberapay]: https://liberapay.com/heliomarpm
[url-liberapay-badge]: https://img.shields.io/badge/liberapay-1C1E26?style=for-the-badge&labelColor=1C1E26&color=f6c915
[url-paypal]: https://bit.ly/paypal-sponsor-heliomarpm
[url-paypal-badge]: https://img.shields.io/badge/donate%20on-paypal-1C1E26?style=for-the-badge&labelColor=1C1E26&color=0475fe

