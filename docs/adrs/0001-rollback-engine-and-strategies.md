# ADR 0001: Mecanismo Híbrido de Rollback e Estratégias de Reversão

* **Status**: Aceito
* **Data**: 2026-11-06
* **Decisores**: Arquitetura gh-workflows & Mantenedores
* **Contexto Técnico**: [Spec 002: Rollback Engine](file:///.agents/specs/002-rollback-engine.md)

---

## 1. Contexto e Problema

O ecossistema `gh-workflows` disponibiliza automações de entrega contínua que geram releases oficiais e atualizam o histórico de changelogs automaticamente via `actions/release` e `cd-release.yml`. Em caso de incidentes em produção provocados por deploys ou releases defeituosas, os mantenedores de repositórios consumidores carecem de uma forma padronizada, rápida e segura de realizar rollback.

As abordagens tradicionais frequentemente exigem intervenções manuais via terminal (`git revert`, push forçado de tags ou manipulação manual de releases no GitHub), o que eleva o tempo de recuperação (MTTR) e introduz alto risco de erro humano ou corrupção de tags imutáveis.

Precisávamos decidir:
1. Qual deve ser o mecanismo arquitetural de entrega da funcionalidade (Action isolada vs Reusable Workflow centralizado vs Híbrido).
2. Quais estratégias de reversão devem ser suportadas e qual deve ser o comportamento padrão.
3. Quais gatilhos de acionamento devem ser permitidos, assegurando compatibilidade com contas gratuitas do GitHub sem comprometer a segurança.

---

## 2. Decisão

Decidimos implementar uma arquitetura **Híbrida de Rollback** baseada em:

1. **Camada de Domínio em Custom Action TypeScript**:
   Criar `actions/rollback` com entrypoint compilado em `dist/rollback/index.js` via `@vercel/ncc`, garantindo boot imediato (< 1s) sem execução de `npm install` no consumidor.
2. **Camada de Orquestração em Reusable Workflow**:
   Expor `.github/workflows/cd-rollback.yml` para consumo simples com configuração de ~10 linhas no repositório consumidor.
3. **Estratégias de Rollback Parametrizadas**:
   - `revert` (**Padrão**): Executa roll-forward via `git revert` na branch principal, atualiza changelog e publica nova tag SemVer patch.
   - `redeploy`: Identifica a versão e commit anteriores estáveis e expõe outputs estruturados (`target_version`, `target_commit`), delegando a re-execução do deploy aos jobs downstream.
   - `delete-tag`: Expurgo de tag/release defeituosa, estritamente condicionado ao input `allow_destructive: true`.
4. **Gatilhos Duplos Suportados**:
   - `workflow_dispatch`: Acionamento manual via UI do GitHub Actions por usuários autorizados.
   - `issues: [opened]`: Acionamento orientado a eventos via Issue Form, protegido por verificação de permissão de colaborador (`write`/`admin`) via GitHub REST API.
5. **Cascata de Detecção do Alvo**:
   Versão informada $\rightarrow$ Tag anterior no Git $\rightarrow$ Commit imediatamente anterior (`HEAD~1`).
6. **Fail-Fast em Conflitos**:
   Em caso de conflito no `git revert`, aborta a operação (`git revert --abort`), evitando corrupção de estado, e renderiza um Job Summary com diagnóstico e instruções de contorno manual.

---

## 3. Alternativas Consideradas

### Alternativa 1: Rollback puramente destrutivo (Reset/Deleção de Tag)
* **Prós**: Volta exatamente ao estado anterior no Git.
* **Contras**: Viola o princípio de imutabilidade de releases; corrompe caches de mirrors e gerenciadores de pacotes (ex: NPM, Packagist); risco catastrófico de perda de commits.
* **Resultado**: Rejeitada como padrão; mantida apenas como opção avançada restrita (`strategy: delete-tag` com confirmação explícita).

### Alternativa 2: Exclusividade de Scripts em Shell no Reusable Workflow (sem TypeScript Action)
* **Prós**: Menos arquivos de compilação em `src/` e `dist/`.
* **Contras**: Dificuldade extrema de testes unitários automatizados com Vitest; problemas crônicos de portabilidade entre shells (Bash vs PowerShell); parsing frágil de JSON da API do GitHub.
* **Resultado**: Rejeitada em prol da consistência com a arquitetura Node/TypeScript do repositório.

### Alternativa 3: Acionamento exclusivo por Issue sem controle de privilégios
* **Prós**: Simples de configurar.
* **Contras**: Vulnerabilidade severa em repositórios públicos (qualquer usuário poderia abrir uma issue e reverter branches de produção).
* **Resultado**: Descartada; a integração com Issues só foi aceita com checagem ativa de privilégios via Octokit.

---

## 4. Consequências e Trade-offs

### Consequências Positivas
- **Velocidade de Recuperação (MTTR reduzido)**: Rollback executável em menos de 1 minuto diretamente pela UI do GitHub ou Issue.
- **Segurança de Histórico**: O modo `revert` padrão garante rastreabilidade total (roll-forward) sem reescrita de histórico público.
- **Portabilidade Total**: Funciona em contas gratuitas do GitHub tanto para repositórios públicos quanto privados.
- **Facilidade de Teste**: A lógica pode ser mockada e testada 100% no Vitest em tempo recorde (< 4s).

### Trade-offs e Custos
- **Manutenção de Bundle**: Exige manter `dist/rollback/index.js` sincronizado com `src/actions/rollback.ts` a cada alteração.
- **Branch Protection**: Se a branch `main` tiver regras bloqueando pushes diretos de bots, o repositório consumidor precisará autorizar a identidade do bot ou utilizar branches transitórias.
