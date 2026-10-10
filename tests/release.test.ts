import { describe, expect, it } from 'vitest';
import { release } from '../src/actions/release.js';
import type { ParsedCommit } from '../src/types/index.js';

describe('release action', () => {
	describe('determineBranchMode', () => {
		it('identifica branches de release padrão', () => {
			expect(release.determineBranchMode('main')).toBe('release');
			expect(release.determineBranchMode('master')).toBe('release');
		});

		it('identifica branches de prerelease com glob', () => {
			expect(release.determineBranchMode('release-1.0.0')).toBe('prerelease');
			expect(release.determineBranchMode('release/v2.1.0')).toBe('prerelease');
		});

		it('identifica branch develop', () => {
			expect(release.determineBranchMode('develop')).toBe('develop');
		});

		it('identifica branch feature como other', () => {
			expect(release.determineBranchMode('feature/nova-tela')).toBe('other');
		});
	});

	describe('release.calculateNextVersion', () => {
		const makeCommit = (type: string, description: string, isBreaking = false): ParsedCommit => ({
			hash: 'h',
			shortHash: '1234567',
			type,
			description,
			isBreaking,
			raw: `${type}: ${description}`,
		});

		it('incrementa minor para commit feat (1.0.0 -> 1.1.0)', () => {
			const commits = [makeCommit('feat', 'novo recurso')];
			const res = release.calculateNextVersion('v1.0.0', commits, 'release');
			expect(res.hasBump).toBe(true);
			expect(res.bumpType).toBe('minor');
			expect(res.nextVersion).toBe('v1.1.0');
		});

		it('incrementa patch para commits fix, perf ou revert (1.0.0 -> 1.0.1)', () => {
			const commitsFix = [makeCommit('fix', 'correção de bug')];
			expect(release.calculateNextVersion('v1.0.0', commitsFix, 'release')).toEqual({
				nextVersion: 'v1.0.1',
				bumpType: 'patch',
				hasBump: true,
			});

			const commitsPerf = [makeCommit('perf', 'otimização de cache')];
			expect(release.calculateNextVersion('v1.0.0', commitsPerf, 'release')).toEqual({
				nextVersion: 'v1.0.1',
				bumpType: 'patch',
				hasBump: true,
			});

			const commitsRevert = [makeCommit('revert', 'reverter commit')];
			expect(release.calculateNextVersion('1.0.0', commitsRevert, 'release', 'v')).toEqual({
				nextVersion: 'v1.0.1',
				bumpType: 'patch',
				hasBump: true,
			});
		});

		it('incrementa major para BREAKING CHANGE com prefixo diferente (1.0.0 -> 2.0.0)', () => {
			const commits = [makeCommit('feat', 'quebra de contrato', true)];
			const res = release.calculateNextVersion('v1.0.0', commits, 'release', 'vr');
			expect(res.hasBump).toBe(true);
			expect(res.bumpType).toBe('major');
			expect(res.nextVersion).toBe('v2.0.0');
		});

		it('NÃO dispara bump nem release para docs, chore, ci, test, refactor', () => {
			const commits = [
				makeCommit('docs', 'ajuste no readme'),
				makeCommit('chore', 'atualização de dependências'),
				makeCommit('ci', 'novo job no github actions'),
				makeCommit('test', 'novos testes unitários'),
				makeCommit('refactor', 'limpeza de código sem quebra'),
			];

			const res = release.calculateNextVersion('v1.0.0', commits, 'release');
			expect(res.hasBump).toBe(false);
			expect(res.bumpType).toBe('none');
			expect(res.nextVersion).toBe('v1.0.0');
		});

		it('gera prerelease com sufixo incremental quando em prerelease branch', () => {
			const commits = [makeCommit('feat', 'novo recurso')];
			const res = release.calculateNextVersion(null, commits, 'prerelease', 'v', 'rc');
			expect(res.hasBump).toBe(true);
			expect(res.nextVersion).toBe('v0.0.1-rc.0');
		});
	});
});
