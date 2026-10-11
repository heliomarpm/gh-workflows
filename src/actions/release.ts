import semver from 'semver';

import { commits, getGitHubClient, getRepoContext, git, io, logger, template } from '../core/index.js';

import type { BumpType, ParsedCommit } from '../types/index.js';

export interface ReleaseOptions {
	releaseBranches?: string;
	developBranches?: string;
	prereleaseBranches?: string;
	prereleaseIncremental?: boolean;
	prereleaseSuffix?: string;
	version?: string;
	versionPrefix?: string;
	releaseNotes?: string;
	githubToken?: string;
}

export interface ReleaseResult {
	version: string;
	tag: string;
	hasChanges: boolean;
	releaseNotes: string;
}

export const release = {
	determineBranchMode(
		branch: string,
		releaseBranchesStr = 'main,master',
		prereleaseBranchesStr = 'release-*,release/*',
		developBranchesStr = 'develop,dev,desenv'
	): 'release' | 'prerelease' | 'develop' | 'other' {
		const releaseList = releaseBranchesStr.split(',').map((b) => b.trim());
		if (releaseList.includes(branch)) {
			return 'release';
		}

		const prereleasePatterns = prereleaseBranchesStr.split(',').map((p) => p.trim());
		for (let pattern of prereleasePatterns) {
			//garante que pattern tenha * no final
			if (!pattern.endsWith('*')) {
				pattern = `${pattern}*`;
			}

			const regexStr = `^${pattern.replace(/\*/g, '.*')}$`;
			if (new RegExp(regexStr).test(branch)) {
				return 'prerelease';
			}
		}

		const developList = developBranchesStr.split(',').map((b) => b.trim());
		if (developList.includes(branch)) {
			return 'develop';
		}

		return 'other';
	},

	calculateNextVersion(
		baseTag: string | null,
		commits: ParsedCommit[],
		mode: 'release' | 'prerelease' | 'develop' | 'other',
		versionPrefix?: string,
		prereleaseSuffix?: string,
		prereleaseIncremental?: boolean
	): { nextVersion: string; bumpType: BumpType; hasBump: boolean } {
		let hasBreaking = false;
		let hasFeat = false;
		let hasFix = false;

		for (const commit of commits) {
			if (commit.isBreaking) {
				hasBreaking = true;
			} else if (commit.type === 'feat') {
				hasFeat = true;
			} else if (['fix', 'perf', 'revert'].includes(commit.type)) {
				hasFix = true;
			}
		}

		const hasBump = hasBreaking || hasFeat || hasFix;
		if (!hasBump) {
			return {
				nextVersion: baseTag || `${versionPrefix}1.0.0`,
				bumpType: 'none',
				hasBump: false,
			};
		}

		let bumpType: BumpType = 'patch';
		if (hasBreaking) {
			bumpType = 'major';
		} else if (hasFeat) {
			bumpType = 'minor';
		}

		//capturar qualquer prefixo antes do semver
		const match = baseTag ? baseTag.match(/^[a-zA-Z]+/) : '';
		const vPrefix = match ? match[0] : versionPrefix || '';

		const rawBase = baseTag ? baseTag.replace(vPrefix, '') : '0.0.0';
		const validBase = semver.valid(rawBase) ? rawBase : '0.0.0';

		if (mode === 'prerelease' && prereleaseIncremental !== false) {
			const nextPrerelease = semver.inc(validBase, 'prerelease', prereleaseSuffix || '') || `1.0.0-${prereleaseSuffix || 'rc'}.1`;
			return {
				nextVersion: `${vPrefix}${nextPrerelease}`,
				bumpType,
				hasBump: true,
			};
		}

		const next = semver.inc(validBase, bumpType) || '1.0.0';
		return {
			nextVersion: `${vPrefix}${next}`,
			bumpType,
			hasBump: true,
		};
	},

	async createRelease(options: ReleaseOptions): Promise<ReleaseResult> {
		logger.info('🚀 Inicializando Release Engine...');

		const currentBranch = await git.getCurrentBranch();
		logger.info(`📌 Branch atual: ${currentBranch}`);

		const mode = this.determineBranchMode(currentBranch, options.releaseBranches, options.prereleaseBranches, options.developBranches);
		logger.info(`🎯 Modo de operação: ${mode}`);

		// Se não estiver em release/prerelease e nenhuma versão explícita foi fornecida
		if (mode !== 'release' && mode !== 'prerelease' && (!options.version || options.version.toLowerCase() === 'unreleased')) {
			logger.info(`ℹ️ Branch '${currentBranch}' não é elegível para release.`);
			if (process.env.GITHUB_STEP_SUMMARY) {
				const summary = template.loadAndRender('summary-release-develop.md', {
					CURRENT_BRANCH: currentBranch,
					RELEASE_BRANCHES: options.releaseBranches,
					MODE: mode,
				});

				if (summary) {
					io.summary
						.addRaw(summary)
						.write()
						.catch(() => {});
				}
			}
			return { version: '', tag: '', hasChanges: false, releaseNotes: '' };
		}

		const latestTag = await git.getLatestTag('v*');
		logger.info(`🏷️ Última tag encontrada: ${latestTag || '(nenhuma)'}`);

		const rawCommits = await git.getCommitsSince(latestTag, 'HEAD');
		const parsedCommits = rawCommits.map(commits.parseCommitLine).filter((c): c is ParsedCommit => c !== null);

		let targetVersion = options.version?.trim();
		let releaseNotes = options.releaseNotes?.trim() || '';
		const hasChanges = true;

		if (targetVersion && targetVersion.toLowerCase() !== 'unreleased') {
			logger.info(`💡 Usando versão informada explicitamente: ${targetVersion}`);
		} else {
			const analysis = this.calculateNextVersion(
				latestTag,
				parsedCommits,
				mode,
				options.versionPrefix,
				options.prereleaseSuffix,
				options.prereleaseIncremental
			);
			if (!analysis.hasBump) {
				logger.info('ℹ️ Nenhum commit de impacto SemVer encontrado (apenas docs, chores, etc). Nenhuma release necessária.');
				if (process.env.GITHUB_STEP_SUMMARY) {
					const skippedSummary = template.loadAndRender('summary-release-skipped.md', {
						CURRENT_BRANCH: currentBranch,
						LAST_TAG: latestTag || 'nenhuma',
						COMMITS_COUNT: parsedCommits.length,
					});

					if (skippedSummary) {
						io.summary
							.addRaw(skippedSummary)
							.write()
							.catch(() => {});
					}
				}
				return { version: '', tag: '', hasChanges: false, releaseNotes: '' };
			}
			targetVersion = analysis.nextVersion;
			if (!releaseNotes) {
				const repoContext = process.env.GITHUB_REPOSITORY ? `https://github.com/${process.env.GITHUB_REPOSITORY}` : undefined;
				releaseNotes = commits.buildReleaseNotes(parsedCommits, repoContext);
			}
		}

		const tagName = targetVersion.startsWith('v') ? targetVersion : `v${targetVersion}`;
		logger.info(`🏷️ Nova Git Tag / Release: ${tagName}`);

		// Cria Tag anotada e envia via Git
		await git.createAnnotatedTag(tagName, `Release ${tagName}`);
		await git.pushTag(tagName);
		logger.success(`Tag ${tagName} criada e enviada ao repositório.`);

		// Cria GitHub Release oficial via Octokit
		const token = options.githubToken || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
		if (token) {
			try {
				const client = getGitHubClient(token);
				const { owner, repo } = getRepoContext();
				logger.info(`→ Criando GitHub Release oficial em ${owner}/${repo}...`);
				await client.rest.repos.createRelease({
					owner,
					repo,
					tag_name: tagName,
					name: tagName,
					body: releaseNotes,
					prerelease: mode === 'prerelease',
					draft: false,
				});
				logger.success(`GitHub Release ${tagName} publicada com sucesso!`);
			} catch (err) {
				logger.warning(`Aviso: Falha ao registrar GitHub Release no Octokit: ${err}`);
			}
		}

		// Job Summary
		if (process.env.GITHUB_STEP_SUMMARY) {
			const publishedSummary = template.loadAndRender('summary-release-published.md', {
				STATUS: 'Publicada',
				NEW_VERSION: tagName,
				LAST_VERSION: latestTag || '(inicial)',
				RELEASE_TYPE: mode,
				CURRENT_BRANCH: currentBranch,
				COMMIT: parsedCommits[0]?.shortHash || 'HEAD',
				EXTRA_METADATA: '',
				QUICK_LINKS: '',
				RELEASE_NOTES: releaseNotes,
			});
			if (publishedSummary) {
				io.summary
					.addRaw(publishedSummary)
					.write()
					.catch(() => {});
			}
		}

		return {
			version: targetVersion,
			tag: tagName,
			hasChanges,
			releaseNotes,
		};
	},

	async run(): Promise<void> {
		try {
			const releaseBranches = io.getInput('main-branch') || 'main,master';
			const developBranches = io.getInput('develop-branch') || 'develop,dev,desenv';
			const prereleaseBranches = io.getInput('prerelease-branch') || 'release-*,release/*';
			const prereleaseIncremental = io.getBooleanInput('prerelease-incremental');
			const prereleaseSuffix = io.getInput('prerelease-suffix') || 'rc';
			const version = io.getInput('version');
			const versionPrefix = io.getInput('version-prefix') || 'v';
			const releaseNotes = io.getInput('release-notes');
			const githubToken = io.getInput('github-token');

			const result = await this.createRelease({
				releaseBranches,
				developBranches,
				prereleaseBranches,
				prereleaseIncremental,
				prereleaseSuffix,
				version,
				versionPrefix,
				releaseNotes,
				githubToken,
			});

			io.setOutput('version', result.version);
			io.setOutput('tag', result.tag);
			io.setOutput('has-changes', result.hasChanges.toString());
			io.setOutput('release-notes', result.releaseNotes);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			io.setFailed(`Falha ao criar Release: ${message}`);
			process.exit(1);
		}
	},
};

if (process.env.NODE_ENV !== 'test' && (!process.argv[1] || process.argv[1].includes('release'))) {
	release.run();
}
