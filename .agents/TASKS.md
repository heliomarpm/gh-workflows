# 📋 Project Tasks & Execution Backlog

> **Status Geral**: 🟢 100% Concluído  
> **Progresso**: 7/7 concluídas (100%)  
> **Última Atualização**: 2026-10-10  
> **Arquivo**: `./.agents/TASKS.md`

---

## 🎯 Meta da Iteração / Sprint Atual
Estabilização da esteira de automação de Releases e Changelogs com governança SemVer e suporte a workflows reutilizáveis (`cd-release.yml`).

---

## 🚀 1. Em Progresso (WIP - Limite: 2 tarefas)

*(Nenhuma tarefa em andamento no momento)*

---

## 🚨 2. Bloqueadores & Alta Prioridade

*(Nenhum bloqueador crítico ativo no momento)*

---

## ⚠️ 3. Média Prioridade

*(Nenhuma tarefa pendente)*

---

## 💡 4. Baixa Prioridade / Otimizações

*(Nenhuma tarefa pendente)*

---

## ✅ 5. Concluído Recentemente

- [x] **TASK-001: Mapeamento de outputs no job `release` de `cd-release.yml`** *(Concluído em 2026-10-10)*
  - **Ref**: [cd-release.yml](file:///d:/WORKS/DEV/GitHubActions/gh-workflows/.github/workflows/cd-release.yml#L89-L93)
  - **Resultado**: Adicionado bloco `outputs:` no job `release` repassando `version`, `tag`, `has-changes` e `release-notes` para consumidores externos do `workflow_call`.

- [x] **TASK-002: Correção da condicional booleana para pre-releases incrementais** *(Concluído em 2026-10-10)*
  - **Ref**: [release.ts](file:///d:/WORKS/DEV/GitHubActions/gh-workflows/src/actions/release.ts#L106)
  - **Resultado**: Substituído `|| true` por `prereleaseIncremental !== false`, permitindo que o consumidor desative tags incrementais passando `false`.

- [x] **TASK-003: Restauração do ID numérico no e-mail oficial do bot do GitHub Actions** *(Concluído em 2026-10-10)*
  - **Ref**: [git.ts](file:///d:/WORKS/DEV/GitHubActions/gh-workflows/src/core/git.ts#L48)
  - **Resultado**: E-mail padronizado com `41898282+github-actions[bot]@users.noreply.github.com` garantindo selo de bot verificado na UI do GitHub.

- [x] **TASK-004: Desacoplamento arquitetural em `io.ts` e `commits.ts`** *(Concluído em 2026-10-10)*
  - **Ref**: [io.ts](file:///d:/WORKS/DEV/GitHubActions/gh-workflows/src/core/io.ts), [commits.ts](file:///d:/WORKS/DEV/GitHubActions/gh-workflows/src/core/commits.ts), [logger.ts](file:///d:/WORKS/DEV/GitHubActions/gh-workflows/src/core/logger.ts)
  - **Resultado**: SRP aplicado, I/O isolado do logger e resolução do bug de execução cruzada de bundles NCC.

- [x] **TASK-005: Saneamento e alinhamento de inputs em `cd-release.yml` e remoção de `project-path`** *(Concluído em 2026-10-10)*
  - **Ref**: [cd-release.yml](file:///d:/WORKS/DEV/GitHubActions/gh-workflows/.github/workflows/cd-release.yml), [release.ts](file:///d:/WORKS/DEV/GitHubActions/gh-workflows/src/actions/release.ts), [action.yml](file:///d:/WORKS/DEV/GitHubActions/gh-workflows/actions/release/action.yml)
  - **Resultado**: `project-path` removido da action de release e de `cd-release.yml`, padronizando execução no repositório raiz (`process.cwd()`). Blocos comentados e inputs não utilizados saneados.

- [x] **TASK-006: Limpeza de input inesperado `github-token` em `release.yml` e `changelog`** *(Concluído em 2026-10-10)*
  - **Ref**: [release.yml](file:///d:/WORKS/DEV/GitHubActions/gh-workflows/.github/workflows/release.yml#L47), [action.yml](file:///d:/WORKS/DEV/GitHubActions/gh-workflows/actions/changelog/action.yml)
  - **Resultado**: Removido parâmetro obsoleto `github-token` de `Update Changelog` em `release.yml` e comentários órfãos em `actions/changelog/action.yml`.

- [x] **TASK-007: Correção de referências e links no `README.md`** *(Concluído em 2026-10-10)*
  - **Ref**: [README.md](file:///d:/WORKS/DEV/GitHubActions/gh-workflows/README.md#L27-L33)
  - **Resultado**: Atualizado endpoints e URLs de `reusable-workflows` para `gh-workflows` em issues e badges de contribuidores.
