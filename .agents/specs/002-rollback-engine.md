---
id: 002
titulo: Mecanismo Híbrido de Rollback para Repositórios Consumidores
status: implementada
versao: 0.1.0
atualizado: 2026-11-06
depende-de: []
---

# 📋 Especificação: Mecanismo Híbrido de Rollback

## 1. Visão Geral

### 1.1 Objetivo e Problema
Repositórios consumidores de CI/CD que utilizam o ecossistema `gh-workflows` precisam de um mecanismo confiável, simples e seguro para desarmar incidentes causados por releases defeituosas. Atualmente, o `gh-workflows` provê orquestração de releases automáticas (`actions/release`, `actions/changelog` e `cd-release.yml`), mas não oferece uma contrapartida automatizada para reversão sem intervenção manual complexa no Git e nos registries.

O objetivo é fornecer uma **Custom Action em Node/TypeScript** (`actions/rollback`) e um **Reusable Workflow** (`.github/workflows/cd-rollback.yml`), operando no modelo híbrido, com suporte a múltiplos gatilhos e estratégias parametrizadas.

### 1.2 Escopo (Dentro do Escopo)
- [x] **Ação TypeScript Reutilizável**: Entrypoint `src/actions/rollback.ts` empacotado em `dist/rollback/index.js` via `@vercel/ncc`.
- [x] **Estratégias de Rollback**:
  - `revert` (Padrão): Roll-forward via `git revert`, gerando commit de reversão, atualização de changelog e publicação de nova release SemVer patch.
  - `redeploy`: Localização da versão/commit anterior estável e exportação de outputs estruturados para pipelines downstream de deploy.
  - `delete-tag`: Expurgo e remoção da release e tag defeituosa no GitHub (requer flag explícita `allow_destructive: true`).
- [x] **Gatilhos Múltiplos**:
  - Disparo manual via `workflow_dispatch` com inputs tipados.
  - Disparo orientado a eventos por Issue (`issues: [opened]`) com validação estrita de permissões de autor (`write`/`admin`).
- [x] **Cascata de Detecção de Alvo**:
  - Alvo informado explicitamente no input/issue;
  - Se omitido: release/tag anterior mais recente;
  - Se inexistente: commit imediatamente anterior (`HEAD~1`).
- [x] **Tratamento de Conflito de Merge (Fail-Fast)**: Interrupção limpa com relatório detalhado em GitHub Job Summary contendo instruções passo a passo para contorno manual.
- [x] **Workflow Reutilizável de Orquestração**: `.github/workflows/cd-rollback.yml` (`workflow_call`).

### 1.3 Fora do Escopo
- Provisionamento ou execução de comandos diretos de infraestrutura em nuvem (ex: rollback de pods Kubernetes, instâncias AWS/GCP).
- Resolução mágica ou heurística de conflitos de merge durante `git revert`.

---

## 2. Casos de Uso

### UC-01: Rollback Rápido via `workflow_dispatch` (Emergência)
- **Ator**: Desenvolvedor / SRE com permissão de escrita.
- **Fluxo**:
  1. Operador navega até a aba *Actions* do repositório consumidor e seleciona o workflow de Rollback.
  2. Dispara a execução mantendo os campos vazios (fallback automático) ou informando a tag defeituosa.
  3. A action reverte as alterações, publica a release patch `vX.Y.Z+1` e notifica o Job Summary.

### UC-02: Solicitação de Rollback via Abertura de Issue
- **Ator**: Membro da equipe através de formulário de Issue.
- **Fluxo**:
  1. Cria uma issue com o label/template de rollback especificando a versão e o motivo.
  2. A action intercepta o evento, valida se o criador tem permissão de colaboração (`write` ou `admin`).
  3. Se autorizado, executa o rollback, comenta o resultado na issue e a fecha automaticamente.
  4. Se não autorizado, adiciona comentário alertando a negação de privilégios e fecha a issue.

---

## 3. Requisitos do Sistema

### 3.1 Requisitos Funcionais (RF)

- **RF-01 (MUST)**: A action deve aceitar o input `strategy` com os valores `revert` (default), `redeploy` e `delete-tag`.
- **RF-02 (MUST)**: Quando `strategy: revert`, a action deve executar `git revert` do intervalo de commits correspondente à release defeituosa, commitar as alterações com a identidade `github-actions[bot]` e criar uma nova tag SemVer patch.
- **RF-03 (MUST)**: Quando `strategy: redeploy`, a action não deve modificar o repositório Git, devendo apenas inspecionar o histórico e exportar os outputs `target_version` e `target_commit`.
- **RF-04 (MUST)**: Quando `strategy: delete-tag`, a action deve exigir `allow_destructive: true`. Se falso ou omitido, deve abortar a execução com erro fatal sem efetuar deleções.
- **RF-05 (MUST)**: A action deve resolver o alvo na seguinte ordem de precedência:
  1. Input `target_version` fornecido pelo operador;
  2. Tag anterior à versão atual detectada no histórico Git;
  3. Commit `HEAD~1` caso nenhuma tag anterior seja encontrada.
- **RF-06 (MUST)**: Se acionada por evento de Issue, a action deve consultar a GitHub API para verificar o nível de permissão do autor (`author_association` ou endpoint de permissão de colaborador).
- **RF-07 (MUST)**: Em caso de falha de permissão no gatilho por issue, a action deve postar um comentário de recusa e fechar a issue imediatamente com status `not_planned`.
- **RF-08 (MUST)**: Se o comando `git revert` encontrar conflito de merge, a action deve abortar com `git revert --abort`, registrar erro no console e gerar um GitHub Job Summary formatado com a lista de arquivos conflitantes e comandos para resolução manual.
- **RF-09 (SHOULD)**: A action deve exportar os outputs estruturados: `target_version`, `target_commit`, `rollback_strategy`, `rollback_status` e `new_version`.

### 3.2 Requisitos Não Funcionais (RNF)

- **RNF-01 (Desempenho)**: O tempo de inicialização da action em runners Ubuntu deve ser inferior a 1 segundo (`using: 'node20'` ou `'node24'` empacotado em bundle único via NCC).
- **RNF-02 (Portabilidade)**: A action deve funcionar em runners Linux e ambientes Windows locais sem dependências de shell nativo (`sh`, `bash`, `sed`).
- **RNF-03 (Segurança)**: Nenhuma credencial ou token privado deve ser gravado em logs ou em resumos de Markdown.

---

## 4. Contratos de Integração

### 4.1 Interface da Action (`actions/rollback/action.yml`)

```yaml
name: 'Rollback Engine'
description: 'Executa rollback controlado em repositórios consumidores'
inputs:
  github_token:
    description: 'Token do GitHub com permissões contents: write e issues: write'
    required: true
  strategy:
    description: 'Estratégia de rollback: revert, redeploy ou delete-tag'
    required: false
    default: 'revert'
  target_version:
    description: 'Versão/tag alvo ou commit a reverter (opcional)'
    required: false
    default: ''
  allow_destructive:
    description: 'Permitir operações destrutivas como exclusão de tag'
    required: false
    default: 'false'
  dry_run:
    description: 'Simular ações sem aplicar alterações no Git/GitHub'
    required: false
    default: 'false'
outputs:
  target_version:
    description: 'Versão/tag identificada como alvo'
  target_commit:
    description: 'SHA do commit identificado'
  rollback_strategy:
    description: 'Estratégia utilizada'
  rollback_status:
    description: 'Resultado da execução: success, failed ou aborted'
  new_version:
    description: 'Nova versão publicada (apenas para estratégia revert)'
```

### 4.2 Contrato do Reusable Workflow (`.github/workflows/cd-rollback.yml`)

```yaml
on:
  workflow_call:
    inputs:
      strategy:
        type: string
        default: 'revert'
      target_version:
        type: string
        default: ''
      allow_destructive:
        type: boolean
        default: false
    secrets:
      token:
        required: false
```

---

## 5. Critérios de Aceite (Given / When / Then)

- **CA-01 (Roll-forward com Sucesso)**:
  - **Given** um repositório com as tags `v1.0.0` e `v1.0.1` (sendo `v1.0.1` a mais recente),
  - **When** o operador dispara o rollback com `strategy: revert` sem especificar versão,
  - **Then** a action deve criar um commit de reversão dos commits entre `v1.0.0` e `v1.0.1`, publicar a tag `v1.0.2` e definir `rollback_status=success`.

- **CA-02 (Fallback para HEAD~1)**:
  - **Given** um repositório recém-iniciado sem nenhuma tag Git,
  - **When** o operador dispara o rollback com `strategy: revert`,
  - **Then** a action deve identificar `HEAD~1` como alvo de reversão e aplicar o revert sobre o último commit.

- **CA-03 (Bloqueio Destrutivo Não Autorizado)**:
  - **Given** um repositório com a release `v2.0.0`,
  - **When** o operador solicita `strategy: delete-tag` mantendo `allow_destructive: false`,
  - **Then** a action deve falhar imediatamente com erro informando a necessidade da flag `allow_destructive: true` sem deletar nada.

- **CA-04 (Conflito de Merge no Revert)**:
  - **Given** uma branch principal com modificações que geram conflito na reversão,
  - **When** a action tenta executar `git revert`,
  - **Then** ela deve emitir `git revert --abort`, definir `rollback_status=failed` e produzir um Job Summary com os arquivos conflitantes e comandos de resolução manual.

- **CA-05 (Validação de Autor de Issue)**:
  - **Given** uma issue aberta por um usuário sem permissão de escrita (`read` ou `none`),
  - **When** o workflow de rollback for disparado pelo evento `issues: [opened]`,
  - **Then** a action deve recusar a operação, adicionar comentário na issue avisando sobre falta de privilégios e fechar a issue com `state_reason: not_planned`.

---

## 6. Impacto no Código Existente

- **Novos Arquivos**:
  - `src/actions/rollback.ts` (Entrypoint principal)
  - `actions/rollback/action.yml` (Manifesto da composite/node action)
  - `dist/rollback/index.js` (Bundle compilado)
  - `.github/workflows/cd-rollback.yml` (Reusable workflow)
  - `tests/rollback.test.ts` (Suíte de testes unitários)
  - `templates/summary-rollback.md` (Template de resumo Markdown)
- **Reaproveitamento de Módulos Core Existentes**:
  - `src/core/git.ts`: `getTagList`, `getLatestTag`, `configureGitBot`, `commitAndPush`.
  - `src/core/github.ts`: Inicialização de Octokit autenticado.
  - `src/core/io.ts`: Leitura de inputs, escrita de outputs e `stepSummary`.
  - `src/core/logger.ts`: Logging padronizado (`info`, `success`, `error`).
- **Compatibilidade**: Zero impacto breaking nas actions existentes (`release`, `changelog`).

---

## 7. Premissas, Riscos e Dependências

- **Premissas**:
  - O repositório consumidor concede permissões `contents: write` e `issues: write` para o job de rollback.
  - Repositórios com regras estritas de branch protection que barram push direto de bots devem utilizar estratégias via PR ou branch temporária.
- **Riscos**:
  - Deleção de tags (`delete-tag`) em registries com imutabilidade ativada (ex: NPM não permite re-publicar a mesma versão). Documentar que `delete-tag` foca em Git/GitHub Releases.

---

## 8. Plano de Implementação

- **T-01**: Implementar utilitários de reversão Git e validação de permissão de usuário em `src/core/git.ts` e `src/core/github.ts`. *(RF-05, RF-06, RF-08)*
- **T-02**: Criar template Markdown de Job Summary `templates/summary-rollback.md`. *(RF-08)*
- **T-03**: Criar o entrypoint `src/actions/rollback.ts` com orquestração das três estratégias (`revert`, `redeploy`, `delete-tag`). *(RF-01, RF-02, RF-03, RF-04, RF-07, RF-09)*
- **T-04**: Escrever suíte de testes unitários em `tests/rollback.test.ts` cobrindo todos os cenários e critérios de aceite com Vitest. *(CA-01 até CA-05)*
- **T-05**: Configurar `actions/rollback/action.yml` e adicionar script de build no `package.json` (`build:rollback`). *(RNF-01)*
- **T-06**: Executar build do bundle em `dist/rollback/index.js` via NCC e validar conformidade com Biome (`npm run check`). *(RNF-01, RNF-02)*
- **T-07**: Criar o Reusable Workflow `.github/workflows/cd-rollback.yml`. *(RF-01)*

---

## 9. Tabela de Rastreabilidade

| Requisito | Critério de Aceite | Teste Automatizado | Tarefa de Implementação |
| :--- | :--- | :--- | :--- |
| **RF-01** | CA-01, CA-03 | `tests/rollback.test.ts` | T-03, T-04 |
| **RF-02** | CA-01 | `tests/rollback.test.ts` | T-01, T-03, T-04 |
| **RF-03** | CA-01 | `tests/rollback.test.ts` | T-03, T-04 |
| **RF-04** | CA-03 | `tests/rollback.test.ts` | T-03, T-04 |
| **RF-05** | CA-01, CA-02 | `tests/rollback.test.ts` | T-01, T-03, T-04 |
| **RF-06** | CA-05 | `tests/rollback.test.ts` | T-01, T-03, T-04 |
| **RF-07** | CA-05 | `tests/rollback.test.ts` | T-03, T-04 |
| **RF-08** | CA-04 | `tests/rollback.test.ts` | T-01, T-02, T-04 |
| **RF-09** | CA-01, CA-04 | `tests/rollback.test.ts` | T-03, T-04 |

---

## 10. Histórico de Alterações

| Versão | Data | Tipo | Resumo |
| :--- | :--- | :--- | :--- |
| **0.1.0** | 2026-11-06 | Material | Criação inicial da especificação do mecanismo híbrido de rollback. |
| **1.0.0** | 2026-11-06 | Material | Especificação aprovada pelo mantenedor para implementação. |
| **1.1.0** | 2026-11-06 | Material | Implementação concluída com 100% de cobertura nos critérios de aceite. |
