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

export async function hasWritePermission(client: ReturnType<typeof getGitHubClient>, owner: string, repo: string, username: string): Promise<boolean> {
	try {
		const { data } = await client.rest.repos.getCollaboratorPermissionLevel({
			owner,
			repo,
			username,
		});
		const permission = data.permission;
		return permission === 'admin' || permission === 'write';
	} catch (err) {
		logger.debug(`Erro ao verificar permissão do colaborador '${username}': ${err}`);
		return false;
	}
}

export async function commentAndCloseIssue(
	client: ReturnType<typeof getGitHubClient>,
	owner: string,
	repo: string,
	issueNumber: number,
	comment: string,
	notPlanned = true
): Promise<void> {
	try {
		await client.rest.issues.createComment({
			owner,
			repo,
			issue_number: issueNumber,
			body: comment,
		});
		await client.rest.issues.update({
			owner,
			repo,
			issue_number: issueNumber,
			state: 'closed',
			state_reason: notPlanned ? 'not_planned' : 'completed',
		});
	} catch (err) {
		logger.error(`Falha ao atualizar issue #${issueNumber}: ${err}`);
	}
}

export async function deleteReleaseByTag(client: ReturnType<typeof getGitHubClient>, owner: string, repo: string, tag: string): Promise<boolean> {
	try {
		const { data: release } = await client.rest.repos.getReleaseByTag({
			owner,
			repo,
			tag,
		});
		if (release?.id) {
			await client.rest.repos.deleteRelease({
				owner,
				repo,
				release_id: release.id,
			});
			logger.info(`Release '${tag}' removida com sucesso no GitHub.`);
			return true;
		}
		return false;
	} catch (err) {
		logger.debug(`Nenhuma GitHub Release encontrada para a tag '${tag}' ou falha ao remover: ${err}`);
		return false;
	}
}
