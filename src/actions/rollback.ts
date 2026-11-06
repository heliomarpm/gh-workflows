import * as github from '@actions/github';
import semver from 'semver';
import {
	commentAndCloseIssue,
	deleteReleaseByTag,
	getGitHubClient,
	getRepoContext,
	git,
	hasWritePermission,
	io,
	logger,
	runCommand,
	template,
} from '../core/index.js';
import type { RollbackOptions, RollbackResult, RollbackStrategy } from '../types/index.js';

function calculateNextPatch(currentTag: string | null): string {
	if (!currentTag) {
		return 'v0.0.1';
	}
	const clean = semver.clean(currentTag) || currentTag.replace(/^v/, '');
	const next = semver.inc(clean, 'patch');
	return currentTag.startsWith('v') ? `v${next}` : next || '0.0.1';
}

export const rollback = {
	async execute(options: RollbackOptions, cwd = process.cwd()): Promise<RollbackResult> {
		logger.info('→ 🚀 Inicializando Rollback Engine...');
		logger.info(`→ 🎯 Estratégia configurada: '${options.strategy}'`);

		const strategy: RollbackStrategy = options.strategy || 'revert';
		const token = options.githubToken || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
		let client: ReturnType<typeof getGitHubClient> | null = null;

		if (token) {
			try {
				client = getGitHubClient(token);
			} catch (err) {
				logger.warning(`Aviso: Falha ao instanciar cliente GitHub Octokit: ${err}`);
			}
		}

		// Validação de segurança no gatilho por Issue
		const isIssueEvent = github.context.eventName === 'issues';
		const issueNumber = github.context.payload.issue?.number;
		const sender = github.context.payload.sender?.login || github.context.payload.issue?.user?.login;

		if (isIssueEvent && issueNumber && client && sender) {
			const { owner, repo } = getRepoContext();
			logger.info(`→ Verificando permissões do autor da issue #${issueNumber} (@${sender})...`);
			const permitted = await hasWritePermission(client, owner, repo, sender);

			if (!permitted) {
				const refusalMsg = `❌ **Ação de Rollback Recusada**\n\nO usuário @${sender} não possui permissão de escrita (\`write\` ou \`admin\`) neste repositório.`;
				await commentAndCloseIssue(client, owner, repo, issueNumber, refusalMsg, true);
				throw new Error(`Permissão negada: Usuário @${sender} não possui privilégios de escrita para solicitar rollback.`);
			}
			logger.success(`✅ Permissões de escrita confirmadas para @${sender}.`);
		}

		// 1. Detecção da versão/ref alvo através da cascata
		const targetRef = await git.resolveTargetRef(options.targetVersion, cwd);
		let targetCommit = 'HEAD';
		try {
			targetCommit = await git.getCommitSha(targetRef, cwd);
		} catch (err) {
			logger.warning(`Aviso ao resolver SHA para ref '${targetRef}': ${err}`);
		}

		const currentBranch = await git.getCurrentBranch(cwd);
		logger.info(`→ 📌 Branch atual: ${currentBranch}`);
		logger.info(`→ 🎯 Alvo identificado: '${targetRef}' (commit: ${targetCommit.slice(0, 7)})`);

		// ==========================================
		// ESTRATÉGIA: REDEPLOY
		// ==========================================
		if (strategy === 'redeploy') {
			logger.info('→ 🔄 Executando rollback via Redeploy (apenas exportação de outputs)...');

			if (process.env.GITHUB_STEP_SUMMARY) {
				const summaryContent = template.loadAndRender('summary-rollback.md', {
					TITLE: '🔄 Rollback: Alvo de Redeploy Identificado',
					STATUS: '🟢 **Pronto para Redeploy**',
					STRATEGY: 'redeploy',
					TARGET_VERSION: targetRef,
					TARGET_COMMIT: targetCommit.slice(0, 7),
					CURRENT_BRANCH: currentBranch,
					EXTRA_METADATA: '| **Ação** | Pipeline de deploy downstream pode ser acionado |',
					DETAILS: `A versão estável anterior \`${targetRef}\` foi localizada. Nenhum commit ou tag foi alterado.`,
					INSTRUCTIONS: '',
				});
				if (summaryContent) {
					io.summary
						.addRaw(summaryContent)
						.write()
						.catch(() => {});
				}
			}

			if (isIssueEvent && issueNumber && client) {
				const { owner, repo } = getRepoContext();
				const msg = `✅ **Rollback: Redeploy Identificado**\n\n- **Versão Alvo**: \`${targetRef}\`\n- **Commit**: \`${targetCommit.slice(0, 7)}\`\n- **Status**: Pronto para deploy downstream.`;
				await commentAndCloseIssue(client, owner, repo, issueNumber, msg, false);
			}

			return {
				strategy: 'redeploy',
				targetVersion: targetRef,
				targetCommit,
				status: 'success',
			};
		}

		// ==========================================
		// ESTRATÉGIA: DELETE-TAG
		// ==========================================
		if (strategy === 'delete-tag') {
			logger.info('→ ⚠️ Executando rollback via Expurgo Destrutivo de Tag...');

			if (!options.allowDestructive) {
				throw new Error('Operação destrutiva recusada: A estratégia delete-tag exige allow_destructive: true.');
			}

			if (targetRef === 'HEAD~1' || !targetRef.startsWith('v')) {
				throw new Error(`A estratégia delete-tag exige uma tag SemVer válida como alvo. Valor resolvido: '${targetRef}'`);
			}

			if (options.dryRun) {
				logger.info(`[DRY-RUN] Expurgo da tag ${targetRef} simulado.`);
				return {
					strategy: 'delete-tag',
					targetVersion: targetRef,
					targetCommit,
					status: 'success',
				};
			}

			if (client) {
				const { owner, repo } = getRepoContext();
				await deleteReleaseByTag(client, owner, repo, targetRef);
			}

			try {
				await git.deleteRemoteTag(targetRef, cwd);
				logger.success(`Tag remota '${targetRef}' excluída com sucesso.`);
			} catch (err) {
				logger.warning(`Aviso ao excluir tag remota: ${err}`);
			}

			try {
				await git.deleteLocalTag(targetRef, cwd);
				logger.success(`Tag local '${targetRef}' excluída com sucesso.`);
			} catch (err) {
				logger.warning(`Aviso ao excluir tag local: ${err}`);
			}

			if (process.env.GITHUB_STEP_SUMMARY) {
				const summaryContent = template.loadAndRender('summary-rollback.md', {
					TITLE: '🗑️ Rollback: Tag e Release Excluídas',
					STATUS: '🟡 **Tag Removida**',
					STRATEGY: 'delete-tag',
					TARGET_VERSION: targetRef,
					TARGET_COMMIT: targetCommit.slice(0, 7),
					CURRENT_BRANCH: currentBranch,
					EXTRA_METADATA: '| **Operação** | Expurgo destrutivo de tag e GitHub Release |',
					DETAILS: `A tag \`${targetRef}\` e sua respectiva Release foram removidas do repositório.`,
					INSTRUCTIONS: '',
				});
				if (summaryContent) {
					io.summary
						.addRaw(summaryContent)
						.write()
						.catch(() => {});
				}
			}

			if (isIssueEvent && issueNumber && client) {
				const { owner, repo } = getRepoContext();
				const msg = `✅ **Rollback: Tag Excluída**\n\nA tag \`${targetRef}\` e sua GitHub Release foram removidas com sucesso.`;
				await commentAndCloseIssue(client, owner, repo, issueNumber, msg, false);
			}

			return {
				strategy: 'delete-tag',
				targetVersion: targetRef,
				targetCommit,
				status: 'success',
			};
		}

		// ==========================================
		// ESTRATÉGIA: REVERT (ROLL-FORWARD) - PADRÃO
		// ==========================================
		logger.info('→ ⏪ Executando rollback via Git Revert (Roll-Forward)...');

		// Determina o range de commits para reverter
		const rangeToRevert = targetRef === 'HEAD~1' ? 'HEAD' : `${targetRef}..HEAD`;
		logger.info(`→ Revertendo range de commits: '${rangeToRevert}'...`);

		if (options.dryRun) {
			logger.info(`[DRY-RUN] Revert de '${rangeToRevert}' simulado com sucesso.`);
			return {
				strategy: 'revert',
				targetVersion: targetRef,
				targetCommit,
				status: 'success',
				newVersion: 'v0.0.1-dryrun',
			};
		}

		const revertResult = await git.revertRange(rangeToRevert, cwd);

		if (!revertResult.success) {
			const errorMsg = revertResult.error || 'Conflito de merge durante execução do git revert.';
			logger.error(`❌ ${errorMsg}`);
			const conflictedList = revertResult.conflictedFiles.map((f) => `- \`${f}\``).join('\n');

			const manualInstructions = `> [!IMPORTANT]\n> **Instruções para Resolução Manual:**\n>\n> 1. Atualize sua branch local: \`git checkout ${currentBranch} && git pull origin ${currentBranch}\`\n> 2. Execute a reversão localmente: \`git revert --no-commit ${rangeToRevert}\`\n> 3. Resolva os conflitos nos arquivos:\n${conflictedList}\n> 4. Conclua o commit: \`git commit -m "fix: ⏪ reverte alterações de ${targetRef}"\`\n> 5. Envie para o remoto: \`git push origin ${currentBranch}\``;

			if (process.env.GITHUB_STEP_SUMMARY) {
				const summaryContent = template.loadAndRender('summary-rollback.md', {
					TITLE: '❌ Falha no Rollback: Conflito de Merge',
					STATUS: '🔴 **Falha (Conflito Detectado)**',
					STRATEGY: 'revert',
					TARGET_VERSION: targetRef,
					TARGET_COMMIT: targetCommit.slice(0, 7),
					CURRENT_BRANCH: currentBranch,
					EXTRA_METADATA: '| **Falha** | Conflito de merge impediu o revert automático |',
					DETAILS: `**Erro:** ${errorMsg}\n\n**Arquivos em Conflito:**\n\n${conflictedList}`,
					INSTRUCTIONS: manualInstructions,
				});
				if (summaryContent) {
					io.summary
						.addRaw(summaryContent)
						.write()
						.catch(() => {});
				}
			}

			if (isIssueEvent && issueNumber && client) {
				const { owner, repo } = getRepoContext();
				const issueFailMsg = `❌ **Rollback Falhou: Conflito de Merge**\n\nNão foi possível aplicar \`git revert\` automaticamente.\n\n${manualInstructions}`;
				await commentAndCloseIssue(client, owner, repo, issueNumber, issueFailMsg, true);
			}

			throw new Error(`Rollback abortado devido a conflitos de merge:\n${revertResult.conflictedFiles.join(', ')}`);
		}

		// Cria o commit de reversão
		const latestTag = await git.getLatestTag('v*', cwd);
		const newVersion = calculateNextPatch(latestTag);
		logger.info(`→ 🏷️ Nova versão calculada para roll-forward: ${newVersion}`);

		await git.ensureIdentity(cwd);
		const commitMessage = `fix: ⏪ rollback para ${targetRef} [skip ci]`;
		await runCommand('git', ['commit', '-m', commitMessage], { cwd });

		// Push do commit de reversão
		const pushRes = await runCommand('git', ['push', 'origin', `HEAD:${currentBranch}`], { cwd });
		if (pushRes.exitCode !== 0) {
			throw new Error(`Falha ao enviar commit de reversão: ${pushRes.stderr}`);
		}
		logger.success(`Commit de reversão enviado com sucesso para ${currentBranch}.`);

		// Criação de tag anotada e release
		await git.createAnnotatedTag(newVersion, `Rollback para ${targetRef} (${newVersion})`, cwd);
		await git.pushTag(newVersion, cwd);
		logger.success(`Tag ${newVersion} criada e enviada.`);

		if (client) {
			try {
				const { owner, repo } = getRepoContext();
				await client.rest.repos.createRelease({
					owner,
					repo,
					tag_name: newVersion,
					name: `${newVersion} (Rollback)`,
					body: `## ⏪ Rollback para ${targetRef}\n\nReversão automática das alterações da versão anterior.`,
					draft: false,
					prerelease: false,
				});
				logger.success(`GitHub Release ${newVersion} publicada.`);
			} catch (err) {
				logger.warning(`Aviso ao criar release no GitHub: ${err}`);
			}
		}

		if (process.env.GITHUB_STEP_SUMMARY) {
			const summaryContent = template.loadAndRender('summary-rollback.md', {
				TITLE: '⏪ Rollback Concluído com Sucesso',
				STATUS: '🟢 **Sucesso (Roll-Forward)**',
				STRATEGY: 'revert',
				TARGET_VERSION: targetRef,
				TARGET_COMMIT: targetCommit.slice(0, 7),
				CURRENT_BRANCH: currentBranch,
				EXTRA_METADATA: `| **Nova Versão Publicada** | \`${newVersion}\` |`,
				DETAILS: `As alterações introduzidas desde \`${targetRef}\` foram revertidas e a nova versão \`${newVersion}\` foi lançada.`,
				INSTRUCTIONS: '',
			});
			if (summaryContent) {
				io.summary
					.addRaw(summaryContent)
					.write()
					.catch(() => {});
			}
		}

		if (isIssueEvent && issueNumber && client) {
			const { owner, repo } = getRepoContext();
			const successMsg = `✅ **Rollback Concluído com Sucesso**\n\n- **Alvo**: \`${targetRef}\`\n- **Nova Versão Publicada**: \`${newVersion}\`\n- **Commit**: \`${targetCommit.slice(0, 7)}\``;
			await commentAndCloseIssue(client, owner, repo, issueNumber, successMsg, false);
		}

		return {
			strategy: 'revert',
			targetVersion: targetRef,
			targetCommit,
			status: 'success',
			newVersion,
		};
	},

	async run(): Promise<void> {
		try {
			const strategy = (io.getInput('strategy') || 'revert') as RollbackStrategy;
			const targetVersion = io.getInput('target_version') || io.getInput('target-version');
			const allowDestructive = io.getBooleanInput('allow_destructive') || io.getBooleanInput('allow-destructive');
			const dryRun = io.getBooleanInput('dry_run') || io.getBooleanInput('dry-run');
			const githubToken = io.getInput('github_token') || io.getInput('github-token');

			const result = await this.execute({
				strategy,
				targetVersion,
				allowDestructive,
				dryRun,
				githubToken,
			});

			io.setOutput('target_version', result.targetVersion);
			io.setOutput('target_commit', result.targetCommit);
			io.setOutput('rollback_strategy', result.strategy);
			io.setOutput('rollback_status', result.status);
			if (result.newVersion) {
				io.setOutput('new_version', result.newVersion);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			io.setFailed(`Falha ao executar Rollback: ${message}`);
			process.exit(1);
		}
	},
};

if (process.env.NODE_ENV !== 'test' && (!process.argv[1] || process.argv[1].includes('rollback'))) {
	rollback.run();
}
