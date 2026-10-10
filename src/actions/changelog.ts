import * as fs from 'node:fs';
import * as path from 'node:path';
import { git, logger, template } from '../core/index.js';
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
	githubToken?: string;
}

const SECTION_HEADERS: { type: string; title: string; regex: RegExp }[] = [
	{ type: 'breaking', title: '💥 Breaking Changes', regex: /^(?:.*!|BREAKING CHANGE:)/ },
	{ type: 'feat', title: '🚀 Features', regex: /^feat(?:\(.*\))?:/ },
	{ type: 'fix', title: '🐛 Bug Fixes', regex: /^fix(?:\(.*\))?:/ },
	{ type: 'perf', title: '⚡ Performance Improvements', regex: /^perf(?:\(.*\))?:/ },
	{ type: 'refactor', title: '♻️ Code Refactoring', regex: /^refactor(?:\(.*\))?:/ },
	{ type: 'docs', title: '📝 Documentation', regex: /^docs(?:\(.*\))?:/ },
	{ type: 'test', title: '✅ Tests', regex: /^test(?:\(.*\))?:/ },
	{ type: 'ci', title: '👷 CI & Build System', regex: /^(?:ci|build)(?:\(.*\))?:/ },
	{ type: 'chore', title: '🔧 Miscellaneous', regex: /^chore(?:\(.*\))?:/ },
	{ type: 'revert', title: '⏪ Reverts', regex: /^revert(?:\(.*\))?:/ },
];

export const changelog = {
	parseCommitLine(rawCommit: string): ParsedCommit | null {
		// Espera formato HASH\x1fSHORT_HASH\x1fSUBJECT\x1fBODY
		const parts = rawCommit.split('\x1f');
		if (parts.length < 3) {
			return null;
		}

		const [hash, shortHash, subject, body = ''] = parts;
		const isBreaking = subject.includes('!') || body.includes('BREAKING CHANGE');

		// Filtra commits ruído (merge, chore release, chore changelog, skip ci)
		if (
			subject.startsWith('Merge pull request') ||
			subject.startsWith('Merge branch') ||
			/^chore\((?:release|changelog)\):/i.test(subject) ||
			subject.includes('[skip ci]')
		) {
			return null;
		}

		const match = subject.match(/^([a-zA-Z]+)(?:\(([^)]+)\))?(!)?:\s*(.*)$/);
		if (match) {
			return {
				hash,
				shortHash,
				type: match[1].toLowerCase(),
				scope: match[2],
				description: match[4] || subject,
				body,
				isBreaking,
				raw: subject,
			};
		}

		return {
			hash,
			shortHash,
			type: 'other',
			description: subject,
			body,
			isBreaking,
			raw: subject,
		};
	},

	buildReleaseNotes(commits: ParsedCommit[], repoUrl?: string): string {
		const sections: Record<string, string[]> = {};

		for (const commit of commits) {
			let commitLink = `(${commit.shortHash})`;
			if (repoUrl) {
				commitLink = `([${commit.shortHash}](${repoUrl}/commit/${commit.hash}))`;
			}

			const scopePrefix = commit.scope ? `**${commit.scope}:** ` : '';
			const entry = `- ${scopePrefix}${commit.description} ${commitLink}`;

			if (commit.isBreaking) {
				sections['💥 Breaking Changes'] = sections['💥 Breaking Changes'] || [];
				sections['💥 Breaking Changes'].push(entry);
			}

			let matchedHeader = SECTION_HEADERS.find((h) => h.type === commit.type)?.title;
			if (!matchedHeader) {
				matchedHeader = '📦 Other Changes';
			}

			sections[matchedHeader] = sections[matchedHeader] || [];
			sections[matchedHeader].push(entry);
		}

		const lines: string[] = [];
		for (const header of SECTION_HEADERS) {
			const items = sections[header.title];
			if (items && items.length > 0) {
				lines.push(`### ${header.title}`);
				lines.push(...items);
				lines.push('');
			}
		}

		if (sections['📦 Other Changes'] && sections['📦 Other Changes'].length > 0) {
			lines.push('### 📦 Other Changes');
			lines.push(...sections['📦 Other Changes']);
			lines.push('');
		}

		return lines.join('\n').trim();
	},

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
				const summaryContent = template.loadAndRender('summary-changelog-skipped.md', {
					CHANGELOG_FILE: changelogFileName,
					CURRENT_BRANCH: currentBranch,
					MODE: currentBranch,
					COMMITS_COUNT: parsedCommits.length,
					SINCE_LABEL: latestTag || 'início do histórico',
				});
				if (summaryContent) {
					logger.summary
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
			const summaryContent = template.loadAndRender('summary-changelog.md', {
				CHANGELOG_FILE: changelogFileName,
				VERSION: targetVersion,
				MODE: currentBranch,
				CURRENT_BRANCH: currentBranch,
				COMMITS_COUNT: parsedCommits.length,
				CHANGELOG_NOTES: releaseNotes,
			});
			if (summaryContent) {
				logger.summary
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
			const changelogPath = logger.getInput('changelog-path');
			const changelogFile = logger.getInput('changelog-file');
			const changelogTitle = logger.getInput('changelog-title');
			const branch = logger.getInput('branch');
			const version = logger.getInput('version');
			const enableChangelog = logger.getBooleanInput('enable-changelog');
			const commitMessage = logger.getInput('commit-message');
			const githubToken = logger.getInput('github-token');

			const result = await this.generate({
				changelogPath,
				changelogFile,
				changelogTitle,
				branch,
				version,
				enableChangelog,
				commitMessage,
				githubToken,
			});

			logger.setOutput('version', result.version);
			logger.setOutput('has-changes', result.hasChanges.toString());
			logger.setOutput('release-notes', result.releaseNotes);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			logger.setFailed(`Falha ao gerar Changelog: ${message}`);
			process.exit(1);
		}
	},
};

if (process.env.NODE_ENV !== 'test') {
	changelog.run();
}
