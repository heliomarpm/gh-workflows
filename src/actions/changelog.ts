import * as fs from 'node:fs';
import * as path from 'node:path';
import { commits, git, io, logger, template } from '../core/index.js';
import type { ParsedCommit } from '../types/index.js';

export interface ChangelogResult {
	version: string;
	hasChanges: boolean;
	releaseNotes: string;
}

export interface ChangelogOptions {
	changelogFile?: string;
	changelogTitle?: string;
	commitMessage?: string;

	branch?: string;
	version?: string;
	releaseNotes?: string;

	enableChangelog?: boolean;
	// githubToken?: string;
}

export const changelog = {
	parseCommitLine: commits.parseCommitLine,
	buildReleaseNotes: commits.buildReleaseNotes,

	updateContent(currentChangelog: string, newSectionTitle: string, newSectionNotes: string): string {
		let effectiveNotes = newSectionNotes.trim();

		// 1. Se a seção exata ou versão já existe (ex: [Unreleased] ou [v1.0.0] ou [v1.0.0 - 2026-10-11]), substitui ela diretamente
		const rawVersion = newSectionTitle.split(' - ')[0].trim();
		const escapedRawVersion = rawVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const exactSectionRegex = new RegExp(`(^|\\n)##\\s+\\[${escapedRawVersion}(?:\\s+-\\s+[^\\]]+)?\\][\\s\\S]*?(?=\\n##\\s+\\[|$)`, 'i');

		if (exactSectionRegex.test(currentChangelog)) {
			const newBlock = `## [${newSectionTitle}]\n\n${effectiveNotes}`.trim();
			return currentChangelog.replace(exactSectionRegex, (_match, prefix) => {
				return `${prefix}${newBlock}\n`;
			});
		}

		// 2. Se for uma release de nova versão e existir uma seção [Unreleased], promove [Unreleased] para a nova versão
		const unreleasedRegex = /(^|\n)##\s+\[Unreleased\][\s\S]*?(?=\n##\s+\[|$)/i;
		const unreleasedMatch = currentChangelog.match(unreleasedRegex);
		if (unreleasedMatch) {
			// Se novas notas não foram passadas, preserva o conteúdo existente de [Unreleased]
			if (!effectiveNotes) {
				const existingUnreleasedContent = unreleasedMatch[0].replace(/^[\s\S]*?##\s+\[Unreleased\]\s*\n?/i, '').trim();
				effectiveNotes = existingUnreleasedContent;
			}
			const newBlock = `## [${newSectionTitle}]\n\n${effectiveNotes}`.trim();
			return currentChangelog.replace(unreleasedRegex, (_match, prefix) => {
				return `${prefix}${newBlock}\n`;
			});
		}

		// 3. Se existem outras seções de versão anteriores, insere antes da primeira versão
		const newBlock = `## [${newSectionTitle}]\n\n${effectiveNotes}`.trim();
		const firstVersionMatch = currentChangelog.match(/(?:^|\n)(##\s+\[[\s\S]*)/);
		if (firstVersionMatch && firstVersionMatch.index !== undefined) {
			const matchStart = firstVersionMatch.index + (firstVersionMatch[0].startsWith('\n') ? 1 : 0);
			const before = currentChangelog.slice(0, matchStart).trim();
			const after = currentChangelog.slice(matchStart).trim();
			return `${before}\n\n${newBlock}\n\n${after}\n`;
		}

		// 4. Changelog inicial sem seções prévias, insere no final
		return `${currentChangelog.trim()}\n\n${newBlock}\n`;
	},

	async generate(options: ChangelogOptions): Promise<ChangelogResult> {
		const cwd = path.resolve(process.cwd(), '.');
		const changelogFileName = options.changelogFile || 'CHANGELOG.md';
		const changelogPathFile = path.resolve(cwd, changelogFileName);
		const defaultTitle = '# 📦 Changelog\n\nTodas as alterações notáveis neste projeto serão documentadas neste arquivo.';
		const changelogTitle = options.changelogTitle || defaultTitle;

		logger.info('🚀 Inicializando Changelog Engine...');

		const currentBranch = options.branch || (await git.getCurrentBranch(cwd));
		logger.info(`📌 Branch atual: ${currentBranch}`);

		let releaseNotes = options.releaseNotes?.trim() || '';
		let parsedCommits: ParsedCommit[] = [];

		if (releaseNotes) {
			logger.info('📝 Utilizando release notes pré-calculadas fornecidas via input.');
		} else {
			// Coleta última tag
			let latestTag = await git.getLatestTag('v*', cwd);
			logger.info(`🏷️ Última tag encontrada: ${latestTag || '(nenhuma)'}`);

			// Se a última tag já aponta exatamente para HEAD (ex: release action rodou antes ou tag acabou de ser criada),
			// busca a tag anterior para não resultar em 0 commits
			if (latestTag && (await git.tagPointsToHead(latestTag, cwd))) {
				const previousTag = await git.getPreviousTag(latestTag, cwd);
				logger.info(`ℹ️ Tag ${latestTag} aponta para HEAD. Buscando commits desde tag anterior: ${previousTag || '(nenhuma)'}`);
				latestTag = previousTag;
			}

			const rawCommits = await git.getCommitsSince(latestTag, 'HEAD', cwd);
			parsedCommits = rawCommits.map(this.parseCommitLine).filter((c): c is ParsedCommit => c !== null);

			logger.info(`📊 Analisados ${parsedCommits.length} commits relevantes.`);

			const repoContext = process.env.GITHUB_REPOSITORY ? `https://github.com/${process.env.GITHUB_REPOSITORY}` : undefined;
			releaseNotes = this.buildReleaseNotes(parsedCommits, repoContext);
		}

		// Inicializa o arquivo se não existir
		if (!fs.existsSync(changelogPathFile)) {
			logger.info(`📝 Criando arquivo inicial: ${changelogPathFile}`);
			fs.writeFileSync(changelogPathFile, `${changelogTitle}\n\n`);
		}

		const changelogContent = fs.readFileSync(changelogPathFile, 'utf-8');

		// Verifica se há seção [Unreleased] pré-existente
		const hasExistingUnreleased = /##\s+\[Unreleased\]/i.test(changelogContent);

		const hasChanges = releaseNotes.length > 0 || hasExistingUnreleased;

		if (!hasChanges) {
			logger.info('ℹ️ Nenhuma alteração detectada. O CHANGELOG.md já está atualizado.');
			if (process.env.GITHUB_STEP_SUMMARY) {
				const fallbackSkipped =
					'## ℹ️ Changelog: Nenhuma Nova Alteração\n\n| | |\n| --- | --- |\n| **Status** | ⚪ **Changelog Atualizado (Sem alterações)** |\n| **Arquivo** | `{{CHANGELOG_FILE}}` |\n| **Branch** | `{{CURRENT_BRANCH}}` |\n| **Modo** | `{{MODE}}` |\n| **Commits Analisados** | {{COMMITS_COUNT}} |\n\n> [!NOTE]\n> Nenhum novo commit relevante foi encontrado desde {{SINCE_LABEL}}.\n';

				const summaryContent = template.loadAndRender(
					'summary-changelog-skipped.md',
					{
						CHANGELOG_FILE: changelogFileName,
						CURRENT_BRANCH: currentBranch,
						MODE: currentBranch,
						COMMITS_COUNT: parsedCommits.length,
						SINCE_LABEL: 'início do histórico',
					},
					fallbackSkipped
				);
				if (summaryContent) {
					io.summary
						.addRaw(summaryContent)
						.write()
						.catch(() => {});
				}
			}
			return {
				version: '',
				hasChanges: false,
				releaseNotes: '',
			};
		}

		// Resolução de versão
		const today = new Date().toISOString().split('T')[0];
		let targetVersion = options.version?.trim() || 'Unreleased';

		if (targetVersion.toLowerCase() !== 'unreleased') {
			if (!targetVersion.includes(today)) {
				targetVersion = `${targetVersion} - ${today}`;
			}
		} else {
			targetVersion = 'Unreleased';
		}

		logger.info(`🏷️ Versão alvo do cabeçalho: [${targetVersion}]`);

		const updatedChangelog = this.updateContent(changelogContent, targetVersion, releaseNotes);
		fs.writeFileSync(changelogPathFile, updatedChangelog);
		logger.success('CHANGELOG.md atualizado com sucesso!');

		// Commit opcional
		if (options.enableChangelog !== false && options.enableChangelog !== ('false' as unknown as boolean)) {
			const commitMsg = options.commitMessage || `chore(changelog): update ${targetVersion} [skip ci]`;
			try {
				const commited = await git.commitAndPush(options.changelogFile || 'CHANGELOG.md', commitMsg, cwd, currentBranch);
				if (commited) {
					logger.success('Commit do CHANGELOG.md enviado com sucesso.');
				}
			} catch (err) {
				logger.warning(`Não foi possível enviar o commit do CHANGELOG.md: ${err}`);
			}
		}

		if (process.env.GITHUB_STEP_SUMMARY) {
			const fallbackSummary =
				'## 📦 Changelog Atualizado\n\n| | |\n| --- | --- |\n| **Status** | 🟢 **Atualizado com Sucesso** |\n| **Arquivo** | `{{CHANGELOG_FILE}}` |\n| **Versão / Seção** | `{{VERSION}}` |\n| **Modo** | `{{MODE}}` |\n| **Branch** | `{{CURRENT_BRANCH}}` |\n| **Commits Analisados** | {{COMMITS_COUNT}} |\n\n{{CHANGELOG_NOTES}}\n';

			const summaryContent = template.loadAndRender(
				'summary-changelog.md',
				{
					CHANGELOG_FILE: changelogFileName,
					VERSION: targetVersion,
					MODE: currentBranch,
					CURRENT_BRANCH: currentBranch,
					COMMITS_COUNT: parsedCommits.length > 0 ? parsedCommits.length : options.releaseNotes ? 'pré-calculados' : 0,
					CHANGELOG_NOTES: releaseNotes,
				},
				fallbackSummary
			);
			if (summaryContent) {
				io.summary
					.addRaw(summaryContent)
					.write()
					.catch(() => {});
			}
		}

		return {
			version: options.version || (targetVersion === 'Unreleased' ? targetVersion : targetVersion.split(' - ')[0]),
			hasChanges: true,
			releaseNotes,
		};
	},

	async run(): Promise<void> {
		try {
			const changelogFile = io.getInput('changelog-file');
			const changelogTitle = io.getInput('changelog-title');
			const branch = io.getInput('branch');
			const version = io.getInput('version');
			const releaseNotes = io.getInput('release-notes');
			const enableChangelogInput = io.getInput('enable-changelog');
			const enableChangelog = enableChangelogInput ? io.getBooleanInput('enable-changelog') : true;
			const commitMessage = io.getInput('commit-message');
			// const githubToken = io.getInput('github-token');

			const result = await this.generate({
				changelogFile,
				changelogTitle,
				branch,
				version,
				releaseNotes,
				enableChangelog,
				commitMessage,
				// githubToken,
			});

			io.setOutput('version', result.version);
			io.setOutput('has-changes', result.hasChanges.toString());
			io.setOutput('release-notes', result.releaseNotes);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			io.setFailed(`Falha ao gerar Changelog: ${message}`);
			process.exit(1);
		}
	},
};

if (process.env.NODE_ENV !== 'test' && (!process.argv[1] || process.argv[1].includes('changelog'))) {
	changelog.run();
}
