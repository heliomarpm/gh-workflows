# 🤖 Diretrizes para Assistentes de IA (AGENTS.md)

Este documento estabelece as **Regras de Ouro**, restrições técnicas e convenções mandatórias que qualquer assistente de inteligência artificial ou desenvolvedor deve seguir rigorosamente ao interagir com o repositório **`gh-workflows`**.

---

## 🧭 1. Regras de Ouro de Engenharia

### 1.1. Sincronização Obrigatória de Bundles (`dist/`)
- Todo o código em `src/actions/` é executado nos runners a partir dos arquivos compilados em `dist/` via `@vercel/ncc`.
- **Regra:** Se qualquer arquivo em `src/` for alterado, execute obrigatoriamente `npm run build` e inclua as alterações de `dist/` no mesmo commit da funcionalidade ou correção.
- Nunca realize commits parciais que deixem `dist/` em desacordo com `src/`.

### 1.2. Tipagem Estrita e Qualidade de Código
- O projeto adota TypeScript no modo estrito (`"strict": true` em `tsconfig.json`).
- **Proibido `any`**: Não utilize `any`. Molde contratos, uniões de tipos e interfaces em `src/types/` ou nos arquivos de escopo local.
- Respeite as regras do linter e formatador **Biome** (`biome.json`). Sempre valide alterações com `npm run check`.

### 1.3. Confiabilidade e Testes (Vitest)
- Qualquer alteração na lógica de release, changelog ou templates deve vir acompanhada de testes unitários correspondentes em `tests/`.
- Antes de concluir qualquer tarefa, certifique-se de que a suíte completa de testes (`npm test`) execute em menos de 5 segundos e passe com 100% de sucesso.

### 1.4. Portabilidade Multiplataforma (Windows & Linux)
- O código TypeScript roda tanto no ambiente local do mantenedor (Windows / PowerShell) quanto nos runners do GitHub Actions (Ubuntu Linux).
- Utilize métodos nativos do Node.js (`node:path`, `node:fs`) e `@actions/exec` com argumentos separados em array.
- Não invoque utilitários de shell específicos de Unix (`sed`, `grep`, `awk`) diretamente nas rotinas em TypeScript.
- Arquivos de texto devem manter quebra de linha `LF` e codificação UTF-8 sem BOM.

---

## 📝 2. Convenção de Commits e Histórico Git

Siga estritamente a política de Conventional Commits e o formato padrão do mantenedor:

### 2.1. Formato Canônico
```text
<tipo>(escopo opcional): <gitmoji> <descrição no imperativo>

<corpo opcional explicando motivação e detalhes técnicos>
```

### 2.2. Diretrizes Específicas
1. **Título:** Máximo de 72 caracteres, em português (`pt-br`), sem ponto final.
2. **Gitmoji obrigatório** compatível com o tipo:
   - `feat:` ✨
   - `fix:` 🐛
   - `refactor:` ♻️
   - `perf:` ⚡
   - `test:` ✅
   - `docs:` 📝 ou 🔖
   - `chore:` 🔧 ou 🤖
   - `ci:` 👷
3. **Corpo:** Separado do título por uma linha em branco. A descrição detalhada deve iniciar com verbo no infinitivo.
4. **Breaking Changes:** Adicione `BREAKING CHANGE:` no corpo ou o sinal `!` no tipo (ex: `feat!: 💥 nova assinatura de outputs`).

---

## 🚫 3. O que NÃO Fazer (Restrições Críticas)

- ❌ **NÃO adicione dependências de runtime desnecessárias:** O objetivo do projeto é empacotar bundles autocontidos e minificados.
- ❌ **NÃO execute comandos destrutivos no Git:** Proibido `git reset --hard`, `git clean -fxd` ou `git push --force` sem autorização explícita do usuário.
- ❌ **NÃO quebre contratos de interface de actions e workflows:** Alterações em inputs/outputs de `actions/*/action.yml` ou `cd-release.yml` exigem atualização simultânea nos workflows internos e nos testes.
- ❌ **NÃO altere a identidade oficial do bot Git:** Para automações que realizam commit no repositório do chamador, use exclusivamente:
  - **Nome:** `github-actions[bot]`
  - **E-mail:** `41898282+github-actions[bot]@users.noreply.github.com`
- ❌ **NÃO acerte regex de templates Markdown sem testes:** Se alterar a substituição de seções em `src/actions/changelog.ts` ou interpolações em `src/core/template.ts`, execute `npm test` para garantir que o regex de `## [Unreleased]` ou versões datadas não degrade.

---

## 📋 4. Padrões de Mensagens de Log e Feedback

Para manter a consistência de output no console das GitHub Actions:
- Utilize o módulo `logger` (`src/core/logger.ts`):
  - `logger.info("→ Mensagem informativa")`
  - `logger.success("✅ Ação concluída com sucesso")`
  - `logger.warning("⚠️ Alerta sem interrupção de fluxo")`
  - `logger.error("❌ Erro capturado")`
  - `logger.debug("🔍 Detalhe para depuração")`
- Em caso de falha crítica irrecuperável da action, utilize `io.setFailed(mensagem)` (`src/core/io.ts`).
