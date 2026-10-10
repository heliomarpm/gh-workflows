import { logger, runCommand } from './index.js';

export const git = {
	async isGitRepo(cwd?: string): Promise<boolean> {
		const res = await runCommand('git', ['rev-parse', '--is-inside-work-tree'], { cwd, silent: true });
		return res.exitCode === 0 && res.stdout === 'true';
	},

	async isShallow(cwd?: string): Promise<boolean> {
		const res = await runCommand('git', ['rev-parse', '--is-shallow-repository'], { cwd, silent: true });
		return res.stdout === 'true';
	},

	async getCurrentBranch(cwd?: string): Promise<string> {
		if (process.env.GITHUB_HEAD_REF) {
			return process.env.GITHUB_HEAD_REF;
		}
		if (process.env.GITHUB_REF_NAME) {
			return process.env.GITHUB_REF_NAME;
		}
		const res = await runCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, silent: true });
		return res.exitCode === 0 && res.stdout ? res.stdout : 'main';
	},

	async getLatestTag(pattern = 'v*', cwd?: string): Promise<string | null> {
		const res = await runCommand('git', ['describe', '--tags', '--abbrev=0', '--match', pattern], { cwd, silent: true });
		if (res.exitCode === 0 && res.stdout) {
			return res.stdout.trim();
		}
		return null;
	},

	async getCommitsSince(fromTag?: string | null, toRef = 'HEAD', cwd?: string): Promise<string[]> {
		const range = fromTag ? `${fromTag}..${toRef}` : toRef;
		// Formato com delimitador ASCII 0x1f (Unit Separator): HASH\x1fSHORT_HASH\x1fSUBJECT\x1fBODY
		const res = await runCommand('git', ['log', range, '--pretty=format:%H%x1f%h%x1f%s%x1f%b%x1e'], { cwd, silent: true });

		if (res.exitCode !== 0 || !res.stdout) {
			return [];
		}

		return res.stdout
			.split('\x1e')
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0);
	},

	async createAnnotatedTag(tagName: string, message: string, cwd?: string): Promise<void> {
		const res = await runCommand('git', ['tag', '-a', tagName, '-m', message], { cwd });
		if (res.exitCode !== 0) {
			throw new Error(`Falha ao criar tag git '${tagName}': ${res.stderr}`);
		}
	},

	async pushTag(tagName: string, cwd?: string): Promise<void> {
		const res = await runCommand('git', ['push', 'origin', tagName], { cwd });
		if (res.exitCode !== 0) {
			throw new Error(`Falha ao enviar tag '${tagName}': ${res.stderr}`);
		}
	},

	async hasChanges(filePath?: string, cwd?: string): Promise<boolean> {
		const args = ['status', '--porcelain'];
		if (filePath) {
			args.push(filePath);
		}
		const res = await runCommand('git', args, { cwd, silent: true });
		return res.exitCode === 0 && res.stdout.length > 0;
	},

	async commitAndPush(filePath: string, message: string, cwd?: string): Promise<boolean> {
		await runCommand('git', ['config', 'user.name', 'github-actions[bot]'], { cwd, silent: true });
		await runCommand('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'], { cwd, silent: true });

		await runCommand('git', ['add', filePath], { cwd });
		const hasDiff = await git.hasChanges(filePath, cwd);
		if (!hasDiff) {
			logger.info(`Nenhuma alteração detectada em '${filePath}' para commitar.`);
			return false;
		}

		const commitRes = await runCommand('git', ['commit', '-m', message], { cwd });
		if (commitRes.exitCode !== 0) {
			throw new Error(`Falha ao criar commit: ${commitRes.stderr}`);
		}

		const pushRes = await runCommand('git', ['push'], { cwd });
		if (pushRes.exitCode !== 0) {
			throw new Error(`Falha no push: ${pushRes.stderr}`);
		}
		return true;
	},
};
