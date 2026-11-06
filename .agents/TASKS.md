# 📋 Project Tasks & Execution Backlog

> **Status Geral**: 🟢 Estável / Em Andamento  
> **Progresso**: 14/17 concluídas (82%)  
> **Última Atualização**: 2026-11-06  
> **Arquivo**: `./.agents/TASKS.md`

---

## 🎯 Meta da Iteração / Sprint Atual
Implementação do Mecanismo Híbrido de Rollback (`actions/rollback` e `cd-rollback.yml`) com suporte a múltiplas estratégias (`revert`, `redeploy`, `delete-tag`) e múltiplos gatilhos (`workflow_dispatch`, `issues`), conforme [Spec 002](specs/002-rollback-engine.md) e [ADR 0001](../docs/adrs/0001-rollback-engine-and-strategies.md).

---

## 🚀 1. Em Progresso (WIP - Limite: 2 tarefas)

*(Nenhuma tarefa em andamento no momento)*

---

## 🚨 2. Bloqueadores & Alta Prioridade

*(Nenhum bloqueador crítico ativo no momento)*

---

## ⚠️ 3. Média Prioridade

- [ ] **TASK-008: Implementação de script `typecheck` e ativação no workflow de CI**
  - **Origem**: `-discovery` | **Prioridade**: P2
  - **Ref**: [package.json](../package.json), [.github/workflows/ci.yml](../.github/workflows/ci.yml#L38-L40)
  - **DoD**:
    - [ ] Adicionar script `"typecheck": "tsc --noEmit"` no `package.json`
    - [ ] Descomentar a etapa `Typecheck TypeScript` no workflow `.github/workflows/ci.yml`
    - [ ] Validar execução local com `npm run typecheck` com zero erros

---

## 💡 4. Baixa Prioridade / Otimizações

- [ ] **TASK-009: Alinhamento de versão de Node.js entre manifestos de action e runners de CI**
  - **Origem**: `-discovery` | **Prioridade**: P3
  - **Ref**: [actions/changelog/action.yml](../actions/changelog/action.yml#L51), [actions/release/action.yml](../actions/release/action.yml#L61), [.github/workflows/ci.yml](../.github/workflows/ci.yml#L32)
  - **DoD**:
    - [ ] Avaliar paridade entre `using: 'node24'` nas actions e `node-version: 20` no runner do CI
    - [ ] Atualizar ou documentar formalmente a estratégia de versão de runtime

- [ ] **TASK-010: Registro retroativo de decisões arquiteturais em `docs/adrs/`**
  - **Origem**: `-discovery` | **Prioridade**: P3
  - **Ref**: [docs/adrs/](../docs/adrs), [README.md](../README.md)
  - **DoD**:
    - [ ] Documentar ADR-0002: Adoção do `@vercel/ncc` para bundles autocontidos sem dependências de runtime
    - [ ] Documentar ADR-0003: Parsing estruturado de commits via delimitadores ASCII `0x1f` e `0x1e`

---

## ✅ 5. Concluído Recentemente

- [x] **TASK-011: Utilitários Git de Reversão e Verificação de Permissões** *(Concluído em 2026-11-06)*
  - **Ref**: [src/core/git.ts](../src/core/git.ts), [src/core/github.ts](../src/core/github.ts)
  - **Resultado**: Adicionados métodos de resolução de alvos com cascata (`resolveTargetRef`), `getCommitSha`, `revertRange` com fail-fast, `deleteLocalTag`, `deleteRemoteTag`, `hasWritePermission`, `commentAndCloseIssue` e `deleteReleaseByTag`.

- [x] **TASK-012: Template Markdown de Resumo de Rollback (`summary-rollback.md`)** *(Concluído em 2026-11-06)*
  - **Ref**: [templates/summary-rollback.md](../templates/summary-rollback.md), [tests/templates.test.ts](../tests/templates.test.ts)
  - **Resultado**: Template estruturado com status, estratégia, alvos, branch, erros com arquivos conflitantes e comandos de resolução manual; testado em `templates.test.ts`.

- [x] **TASK-013: Entrypoint da Action de Rollback (`src/actions/rollback.ts`)** *(Concluído em 2026-11-06)*
  - **Ref**: [src/actions/rollback.ts](../src/actions/rollback.ts)
  - **Resultado**: Orquestração completa das estratégias `revert`, `redeploy` e `delete-tag`, validação de segurança no gatilho por issue com autorização via Octokit e emissão de Job Summary.

- [x] **TASK-014: Suíte de Testes Unitários de Rollback (`tests/rollback.test.ts`)** *(Concluído em 2026-11-06)*
  - **Ref**: [tests/rollback.test.ts](../tests/rollback.test.ts)
  - **Resultado**: 11 testes unitários com Vitest cobrindo todos os critérios de aceite (CA-01 até CA-05) com 100% de sucesso em menos de 1s.

- [x] **TASK-015: Manifesto da Action e Scripts de Build (`actions/rollback`)** *(Concluído em 2026-11-06)*
  - **Ref**: [actions/rollback/action.yml](../actions/rollback/action.yml), [package.json](../package.json)
  - **Resultado**: Manifesto oficial da action configurado com `using: node24` e script `"build:rollback"` adicionado ao `package.json`.

- [x] **TASK-016: Compilação de Bundle NCC e Verificação Biome** *(Concluído em 2026-11-06)*
  - **Ref**: [dist/rollback/index.js](../dist/rollback/index.js)
  - **Resultado**: Bundle autocontido e minificado gerado via NCC sem dependências externas; linter e formatador Biome validados com 100% de conformidade.

- [x] **TASK-017: Reusable Workflow de Rollback (`cd-rollback.yml`)** *(Concluído em 2026-11-06)*
  - **Ref**: [.github/workflows/cd-rollback.yml](../.github/workflows/cd-rollback.yml)
  - **Resultado**: Reusable Workflow centralizado (`workflow_call` e `workflow_dispatch`) mapeando inputs, secrets, permissões e outputs para consumidores.

- [x] **TASK-001 até TASK-007**: Tarefas de estabilização da esteira de release, bot Git e refatoração de I/O *(Concluídas em 2026-10-10)*
