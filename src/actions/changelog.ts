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
	changelogPath?: string;
	changelogFile?: string;
	changelogTitle?: string;
	commitMessage?: string;

	branch?: string;
	version?: string;

	enableChangelog?: boolean;
	// githubToken?: string;
}

export const changelog = {
	parseCommitLine: commits.parseCommitLine,
	buildReleaseNotes: commits.buildReleaseNotes,

	updateContent(currentChangelog: string, newSectionTitle: string, newSectionNotes: string): string {
		const newBlock = `## [${newSectionTitle}]\n\n${newSectionNotes}`.trim();

		// 1. Se já existe uma seção [Unreleased], substitui ela
		const unreleasedRegex = /^##\s+\[Unreleased\][\s\S]*?(?=\n##\s+\[|Z)/m;
		if (unreleasedRegex.test(currentChangelog)) {
			return currentChangelog.replace(unreleasedRegex, `${newBlock}\n`);
		}

		// 2. Se existem seções de versão anteriores, insere antes da primeira versão
		const firstVersionMatch = currentChangelog.match(/^##\s+\[/m);
		if (firstVersionMatch && firstVersionMatch.index !== undefined) {
			const before = currentChangelog.slice(0, firstVersionMatch.index).trim();
			const after = currentChangelog.slice(firstVersionMatch.index).trim();
			return `${before}\n\n${newBlock}\n\n${after}\n`;
		}

		// 3. Changelog inicial, insere no final
		return `${currentChangelog.trim()}\n\n${newBlock}\n`;
	},

	async generate(options: ChangelogOptions): Promise<ChangelogResult> {
		const cwd = path.resolve(process.cwd(), options.changelogPath || '.');
		const changelogFileName = options.changelogFile || 'CHANGELOG.md';
		const changelogPathFile = path.resolve(cwd, changelogFileName);
		const defaultTitle = '# 📦 Changelog\n\nTodas as alterações notáveis neste projeto serão documentadas neste arquivo.';
		const changelogTitle = options.changelogTitle || defaultTitle;

		logger.info('🚀 Inicializando Changelog Engine...');

		const currentBranch = options.branch || (await git.getCurrentBranch(cwd));
		logger.info(`📌 Branch atual: ${currentBranch}`);

		// Coleta última tag
		const latestTag = await git.getLatestTag('v*', cwd);
		logger.info(`🏷️ Última tag encontrada: ${latestTag || '(nenhuma)'}`);

		const rawCommits = await git.getCommitsSince(latestTag, 'HEAD', cwd);
		const parsedCommits = rawCommits.map(this.parseCommitLine).filter((c): c is ParsedCommit => c !== null);

		logger.info(`📊 Analisados ${parsedCommits.length} commits relevantes.`);

		const repoContext = process.env.GITHUB_REPOSITORY ? `https://github.com/${process.env.GITHUB_REPOSITORY}` : undefined;
		const releaseNotes = this.buildReleaseNotes(parsedCommits, repoContext);

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
						SINCE_LABEL: latestTag || 'início do histórico',
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
				const commited = await git.commitAndPush(options.changelogFile || 'CHANGELOG.md', commitMsg, cwd);
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
					COMMITS_COUNT: parsedCommits.length,
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
			const changelogPath = io.getInput('changelog-path');
			const changelogFile = io.getInput('changelog-file');
			const changelogTitle = io.getInput('changelog-title');
			const branch = io.getInput('branch');
			const version = io.getInput('version');
			const enableChangelogInput = io.getInput('enable-changelog');
			const enableChangelog = enableChangelogInput ? io.getBooleanInput('enable-changelog') : true;
			const commitMessage = io.getInput('commit-message');
			// const githubToken = io.getInput('github-token');

			const result = await this.generate({
				changelogPath,
				changelogFile,
				changelogTitle,
				branch,
				version,
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
