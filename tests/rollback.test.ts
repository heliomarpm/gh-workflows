import * as github from '@actions/github';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rollback } from '../src/actions/rollback.js';
import { git } from '../src/core/git.js';
import * as githubCore from '../src/core/github.js';

describe('Rollback Engine', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		process.env.GITHUB_STEP_SUMMARY = '';
	});

	describe('Detecção de Alvo (Cascata)', () => {
		it('utiliza a versão alvo informada explicitamente', async () => {
			const res = await git.resolveTargetRef('v1.5.0');
			expect(res).toBe('v1.5.0');
		});

		it('faz fallback para a tag anterior quando houver tags no histórico', async () => {
			vi.spyOn(git, 'getLatestTag').mockResolvedValue('v2.0.0');
			vi.spyOn(git, 'getPreviousTag').mockResolvedValue('v1.9.0');

			const res = await git.resolveTargetRef();
			expect(res).toBe('v1.9.0');
		});

		it('faz fallback para HEAD~1 quando não houver tag anterior', async () => {
			vi.spyOn(git, 'getLatestTag').mockResolvedValue(null);

			const res = await git.resolveTargetRef();
			expect(res).toBe('HEAD~1');
		});
	});

	describe('CA-01: Roll-forward com Sucesso (strategy: revert)', () => {
		it('reverte commits, commita e cria nova versão SemVer patch', async () => {
			vi.spyOn(git, 'resolveTargetRef').mockResolvedValue('v1.0.0');
			vi.spyOn(git, 'getCommitSha').mockResolvedValue('abcdef123456');
			vi.spyOn(git, 'getCurrentBranch').mockResolvedValue('main');
			vi.spyOn(git, 'revertRange').mockResolvedValue({ success: true, conflictedFiles: [] });
			vi.spyOn(git, 'getLatestTag').mockResolvedValue('v1.0.1');
			vi.spyOn(git, 'ensureIdentity').mockResolvedValue(undefined);
			vi.spyOn(git, 'createAnnotatedTag').mockResolvedValue(undefined);
			vi.spyOn(git, 'pushTag').mockResolvedValue(undefined);

			// Mock dos comandos git runCommand
			const { runCommand } = await import('../src/core/exec.js');
			vi.spyOn({ runCommand }, 'runCommand').mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

			const result = await rollback.execute({
				strategy: 'revert',
				targetVersion: 'v1.0.0',
				dryRun: true, // Simulado para ambiente unitário
			});

			expect(result.status).toBe('success');
			expect(result.strategy).toBe('revert');
			expect(result.targetVersion).toBe('v1.0.0');
			expect(result.newVersion).toBeDefined();
		});
	});

	describe('CA-02: Fallback para HEAD~1 em repositório novo', () => {
		it('reverte HEAD quando não há tags no histórico', async () => {
			vi.spyOn(git, 'resolveTargetRef').mockResolvedValue('HEAD~1');
			vi.spyOn(git, 'getCommitSha').mockResolvedValue('commit0001');
			vi.spyOn(git, 'getCurrentBranch').mockResolvedValue('main');

			const result = await rollback.execute({
				strategy: 'revert',
				dryRun: true,
			});

			expect(result.status).toBe('success');
			expect(result.targetVersion).toBe('HEAD~1');
		});
	});

	describe('CA-03: Bloqueio Destrutivo (strategy: delete-tag)', () => {
		it('lança erro se allow_destructive for falso ou omitido', async () => {
			vi.spyOn(git, 'resolveTargetRef').mockResolvedValue('v1.0.1');
			vi.spyOn(git, 'getCommitSha').mockResolvedValue('abcdef123');
			vi.spyOn(git, 'getCurrentBranch').mockResolvedValue('main');

			await expect(
				rollback.execute({
					strategy: 'delete-tag',
					targetVersion: 'v1.0.1',
					allowDestructive: false,
				})
			).rejects.toThrow(/Operação destrutiva recusada/);
		});

		it('lança erro se o alvo para delete-tag for HEAD~1 em vez de tag', async () => {
			vi.spyOn(git, 'resolveTargetRef').mockResolvedValue('HEAD~1');
			vi.spyOn(git, 'getCommitSha').mockResolvedValue('abcdef123');
			vi.spyOn(git, 'getCurrentBranch').mockResolvedValue('main');

			await expect(
				rollback.execute({
					strategy: 'delete-tag',
					allowDestructive: true,
				})
			).rejects.toThrow(/exige uma tag SemVer válida/);
		});

		it('permite delete-tag quando allow_destructive for true', async () => {
			vi.spyOn(git, 'resolveTargetRef').mockResolvedValue('v1.0.1');
			vi.spyOn(git, 'getCommitSha').mockResolvedValue('abcdef123');
			vi.spyOn(git, 'getCurrentBranch').mockResolvedValue('main');

			const result = await rollback.execute({
				strategy: 'delete-tag',
				targetVersion: 'v1.0.1',
				allowDestructive: true,
				dryRun: true,
			});

			expect(result.status).toBe('success');
			expect(result.strategy).toBe('delete-tag');
		});
	});

	describe('CA-04: Conflito de Merge no Revert (Fail-Fast)', () => {
		it('aborta imediatamente e lança erro ao encontrar conflito', async () => {
			vi.spyOn(git, 'resolveTargetRef').mockResolvedValue('v1.0.0');
			vi.spyOn(git, 'getCommitSha').mockResolvedValue('abcdef123');
			vi.spyOn(git, 'getCurrentBranch').mockResolvedValue('main');
			vi.spyOn(git, 'revertRange').mockResolvedValue({
				success: false,
				conflictedFiles: ['src/index.ts', 'package.json'],
				error: 'CONFLICT (content): Merge conflict in src/index.ts',
			});

			await expect(
				rollback.execute({
					strategy: 'revert',
					targetVersion: 'v1.0.0',
					dryRun: false,
				})
			).rejects.toThrow(/Rollback abortado devido a conflitos de merge/);
		});
	});

	describe('CA-05: Validação de Autor no Gatilho por Issue', () => {
		it('recusa e lança erro quando o autor não tem permissão de escrita', async () => {
			// Simula contexto de evento de issue
			// @ts-expect-error Mock parcial do contexto do GitHub Actions
			github.context.eventName = 'issues';
			// @ts-expect-error Mock parcial do payload
			github.context.payload = {
				issue: { number: 42, user: { login: 'hacker' } },
				sender: { login: 'hacker' },
			};

			vi.spyOn(githubCore, 'getRepoContext').mockReturnValue({ owner: 'acme', repo: 'app' });
			vi.spyOn(githubCore, 'hasWritePermission').mockResolvedValue(false);
			const commentSpy = vi.spyOn(githubCore, 'commentAndCloseIssue').mockResolvedValue(undefined);

			await expect(
				rollback.execute({
					strategy: 'revert',
					githubToken: 'fake-token',
				})
			).rejects.toThrow(/Permissão negada/);

			expect(commentSpy).toHaveBeenCalledWith(expect.anything(), 'acme', 'app', 42, expect.stringContaining('não possui permissão de escrita'), true);
		});
	});

	describe('Estratégia: Redeploy', () => {
		it('localiza o alvo e exporta outputs sem alterar o repositório', async () => {
			vi.spyOn(git, 'resolveTargetRef').mockResolvedValue('v2.4.0');
			vi.spyOn(git, 'getCommitSha').mockResolvedValue('sha7890123');
			vi.spyOn(git, 'getCurrentBranch').mockResolvedValue('production');

			const result = await rollback.execute({
				strategy: 'redeploy',
				targetVersion: 'v2.4.0',
			});

			expect(result.status).toBe('success');
			expect(result.strategy).toBe('redeploy');
			expect(result.targetVersion).toBe('v2.4.0');
			expect(result.targetCommit).toBe('sha7890123');
		});
	});
});
