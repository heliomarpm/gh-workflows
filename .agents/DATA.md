# 💾 Modelo de Dados e Integrações: gh-workflows (DATA.md)

Este documento descreve a modelagem de dados em memória, persistência em arquivos versionados e contratos de integração externa do projeto **`gh-workflows`**.

---

## 🏛️ 1. Arquitetura de Dados & Persistência

Por ser uma biblioteca de ferramentas e ações para **GitHub Actions e CI/CD**, o projeto **não utiliza bancos de dados relacionais tradicionais (SQL)** nem repositórios de dados externos persistentes. 

Toda a persistência e estado são regidos por:
1. **Histórico e Objetos do Git**: Commits, Git Tags anotadas, árvores de branches e metadados de autoria.
2. **Arquivos Versionados no Repositório**:
   - `CHANGELOG.md`: Registro contínuo de alterações baseado no padrão Keep a Changelog.
   - `dist/`: Bundles executáveis gerados e versionados para execução direta no runner.
3. **Recursos de API do GitHub**: GitHub Releases oficiais, Pull Requests, Labels e Job Summaries.

---

## 🧩 2. Entidades Centrais e Estruturas de Domínio

### 2.1. `ParsedCommit`
Representa um commit do Git parseado e categorizado sob a ótica de Conventional Commits:

```typescript
interface ParsedCommit {
  hash: string;         // Hash completo SHA-1 (40 caracteres)
  shortHash: string;    // Hash curto (7 caracteres)
  type: string;         // Tipo do commit ('feat', 'fix', 'chore', etc.)
  scope?: string;       // Escopo opcional entre parênteses
  description: string;  // Mensagem resumida no imperativo
  body?: string;        // Detalhes estendidos do corpo do commit
  isBreaking: boolean;  // Identificado por '!' no cabeçalho ou 'BREAKING CHANGE:' no corpo
  raw: string;          // Linha de assunto bruta original
}
```

### 2.2. `BumpType`
Determina a intensidade do incremento de versão semântica:
```typescript
type BumpType = 'major' | 'minor' | 'patch' | 'none';
```
- `major`: Disparado por breaking changes (`isBreaking === true`).
- `minor`: Disparado por novos recursos (`type === 'feat'`).
- `patch`: Disparado por correções e melhorias (`fix`, `perf`, `revert`).
- `none`: Disparado por alterações que não alteram a versão do produto (`docs`, `chore`, `ci`, `test`, `refactor`).

### 2.3. Contratos de Entrada e Saída de Operações

#### Release (`src/actions/release.ts`)
- **`ReleaseOptions`**: Configurações de branches (`mainBranch`, `developBranch`, `prereleaseBranch`), modos incrementais (`prereleaseIncremental`), sufixo (`prereleaseSuffix`), versão e token.
- **`ReleaseResult`**:
  ```typescript
  interface ReleaseResult {
    version: string;      // Ex: "1.1.0" ou "1.1.0-rc.1"
    tag: string;          // Ex: "v1.1.0" ou "v1.1.0-rc.1"
    hasChanges: boolean;  // Indica se houveram commits elegíveis para bump
    releaseNotes: string; // Markdown com as notas geradas
  }
  ```

#### Changelog (`src/actions/changelog.ts`)
- **`ChangelogOptions`**: Caminho do arquivo (`changelogFile`), título (`changelogTitle`), mensagem de commit (`commitMessage`), notas pré-calculadas e branch alvo.
- **`ChangelogResult`**:
  ```typescript
  interface ChangelogResult {
    version: string;      // Versão aplicada ou "Unreleased"
    hasChanges: boolean;  // Se houve alteração no arquivo CHANGELOG.md
    releaseNotes: string; // Notas de release geradas
  }
  ```

---

## 📝 3. Ciclo de Vida do Arquivo `CHANGELOG.md`

O motor de changelog implementa um algoritmo idempotente baseado em expressões regulares estruturadas:

1. **Substituição de Versão Existente**: Se a seção correspondente à versão já existe (ex: `## [v1.0.0]`), o bloco é atualizado mantendo o restante do histórico íntegro.
2. **Promoção de `[Unreleased]`**: Em branches de release (`main`), caso exista uma seção `## [Unreleased]`, o seu conteúdo é automaticamente promovido para a versão oficial datada `## [vX.Y.Z - YYYY-MM-DD]`.
3. **Agrupamento Semântico de Notas**:
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

---

## 🌐 4. Sistemas Externos & Protocolos de Integração

| Sistema / Componente | Mecanismo de Acesso | Propósito |
| :--- | :--- | :--- |
| **GitHub REST API** | `@actions/github` (Octokit) | Criação de GitHub Releases oficiais, publicação de notas e gestão de Pull Requests. |
| **Git Engine Local** | `@actions/exec` (`git CLI`) | Execução de `git describe`, `git rev-parse`, `git log` com separadores ASCII `\x1f`/`\x1e`, e commit de arquivos. |
| **Ambiente de Runner** | `@actions/core` | Captura de inputs (`INPUT_*`), escrita de outputs (`$GITHUB_OUTPUT`) e renderização de Job Summaries (`$GITHUB_STEP_SUMMARY`). |
| **Autenticação de Bot** | Git Config local | Configuração programática da identidade oficial de autor `github-actions[bot]`. |
