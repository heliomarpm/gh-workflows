import * as github from '@actions/github';
import { logger } from './index.js';

export function getGitHubClient(token?: string) {
	const resolvedToken = token || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
	if (!resolvedToken) {
		throw new Error('GitHub Token não encontrado! Defina o input GH_TOKEN ou a variável de ambiente GITHUB_TOKEN.');
	}
	return github.getOctokit(resolvedToken);
}

export function getRepoContext() {
	const { owner, repo } = github.context.repo;
	return { owner, repo };
}

export async function findExistingPullRequest(client: ReturnType<typeof getGitHubClient>, owner: string, repo: string, head: string, base: string) {
	try {
		const { data: prs } = await client.rest.pulls.list({
			owner,
			repo,
			head: `${owner}:${head}`,
			base,
			state: 'open',
		});
		return prs.length > 0 ? prs[0] : null;
	} catch (err) {
		logger.debug(`Erro ao buscar PRs existentes: ${err}`);
		return null;
	}
}
