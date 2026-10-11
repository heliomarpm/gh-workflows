import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { changelog } from '../src/actions/changelog.js';

describe('changelog action', () => {
	describe('parseCommitLine', () => {
		it('parseia commits do tipo feat e fix', () => {
			const featRaw = 'hash123\x1f1234567\x1ffeat(auth): login com github\x1fcorpo do commit';
			const parsedFeat = changelog.parseCommitLine(featRaw);

			expect(parsedFeat).not.toBeNull();
			expect(parsedFeat?.type).toBe('feat');
			expect(parsedFeat?.scope).toBe('auth');
			expect(parsedFeat?.description).toBe('login com github');
			expect(parsedFeat?.isBreaking).toBe(false);

			const fixRaw = 'hash456\x1f4567890\x1ffix: corrigir timeout na api\x1f';
			const parsedFix = changelog.parseCommitLine(fixRaw);
			expect(parsedFix?.type).toBe('fix');
			expect(parsedFix?.description).toBe('corrigir timeout na api');
		});

		it('identifica breaking change com exclamação ou no corpo', () => {
			const breakingRaw = 'hash789\x1f7890123\x1ffeat(db)!: remover suporte a sqlite\x1f';
			const parsed = changelog.parseCommitLine(breakingRaw);
			expect(parsed?.isBreaking).toBe(true);

			const breakingBody = 'hash999\x1f9999999\x1frefactor: novo schema\x1fBREAKING CHANGE: tabelas renomeadas';
			const parsedBody = changelog.parseCommitLine(breakingBody);
			expect(parsedBody?.isBreaking).toBe(true);
		});

		it('ignora commits de merge e releases automáticas', () => {
			expect(changelog.parseCommitLine('h\x1fh\x1fMerge pull request #10 from branch\x1f')).toBeNull();
			expect(changelog.parseCommitLine('h\x1fh\x1fchore(release): v1.0.0 [skip ci]\x1f')).toBeNull();
			expect(changelog.parseCommitLine('h\x1fh\x1fchore(changelog): update [skip ci]\x1f')).toBeNull();
			expect(changelog.parseCommitLine('h\x1fh\x1fdocs: ajuste [skip ci]\x1f')).toBeNull();
		});
	});

	describe('buildReleaseNotes', () => {
		it('agrupa commits por seções esperadas', () => {
			const commits = [
				{
					hash: 'h1',
					shortHash: '1111111',
					type: 'feat',
					scope: 'ui',
					description: 'novo botão de exportação',
					isBreaking: false,
					raw: 'feat(ui): novo botão de exportação',
				},
				{
					hash: 'h2',
					shortHash: '2222222',
					type: 'fix',
					description: 'corrigir vazamento de memória',
					isBreaking: false,
					raw: 'fix: corrigir vazamento de memória',
				},
			];

			const notes = changelog.buildReleaseNotes(commits);
			expect(notes).toContain('### 🚀 Features');
			expect(notes).toContain('- **ui:** novo botão de exportação (1111111)');
			expect(notes).toContain('### 🐛 Bug Fixes');
			expect(notes).toContain('- corrigir vazamento de memória (2222222)');
		});
	});

	describe('updateChangelogContent', () => {
		it('substitui atomicamente a seção [Unreleased] existente', () => {
			const initial = '# 📦 Changelog\n\n## [Unreleased]\n\n### 🚀 Features\n- funcionalidade antiga\n\n## [v1.0.0] - 2026-01-01\n\n- inicial\n';
			const updated = changelog.updateContent(initial, 'v1.1.0 - 2026-10-09', '### 🚀 Features\n- nova funcionalidade');

			expect(updated).not.toContain('## [Unreleased]');
			expect(updated).toContain('## [v1.1.0 - 2026-10-09]');
			expect(updated).toContain('nova funcionalidade');
			expect(updated).toContain('## [v1.0.0] - 2026-01-01');
		});

		it('insere antes da primeira versão quando não há [Unreleased]', () => {
			const initial = '# 📦 Changelog\n\n## [v1.0.0] - 2026-01-01\n\n- inicial\n';
			const updated = changelog.updateContent(initial, 'Unreleased', '### 🚀 Features\n- pendente');

			expect(updated).toContain('## [Unreleased]\n\n### 🚀 Features\n- pendente\n\n## [v1.0.0] - 2026-01-01');
		});

		it('atualiza [Unreleased] in-place sem duplicar quando é a única seção do arquivo', () => {
			const initial = '# 📦 Changelog\n\n## [Unreleased]\n\n### 🚀 Features\n- funcionalidade antiga\n';
			const updated = changelog.updateContent(initial, 'Unreleased', '### 🚀 Features\n- funcionalidade nova');

			const matches = updated.match(/##\s+\[Unreleased\]/g);
			expect(matches).toHaveLength(1);
			expect(updated).toContain('funcionalidade nova');
			expect(updated).not.toContain('funcionalidade antiga');
		});

		it('atualiza uma versão existente in-place sem duplicar se o workflow for re-executado', () => {
			const initial = '# 📦 Changelog\n\n## [v1.0.0 - 2026-10-10]\n\n### 🚀 Features\n- nota antiga\n';
			const updated = changelog.updateContent(initial, 'v1.0.0 - 2026-10-10', '### 🚀 Features\n- nota nova atualizada');

			const matches = updated.match(/##\s+\[v1\.0\.0/g);
			expect(matches).toHaveLength(1);
			expect(updated).toContain('nota nova atualizada');
			expect(updated).not.toContain('nota antiga');
		});

		it('preserva notas existentes em [Unreleased] quando promovido para versão sem novas notas', () => {
			const initial = '# 📦 Changelog\n\n## [Unreleased]\n\n### 🚀 Features\n- funcionalidade acumulada\n\n## [v1.0.0] - 2026-01-01\n\n- inicial\n';
			const updated = changelog.updateContent(initial, 'v1.1.0 - 2026-10-11', '');

			expect(updated).not.toContain('## [Unreleased]');
			expect(updated).toContain('## [v1.1.0 - 2026-10-11]');
			expect(updated).toContain('### 🚀 Features\n- funcionalidade acumulada');
			expect(updated).toContain('## [v1.0.0] - 2026-01-01');
		});
	});

	describe('generate with releaseNotes', () => {
		it('utiliza release-notes pré-calculadas fornecidas via options', async () => {
			const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'changelog-test-'));
			const changelogPath = path.join(tmpDir, 'CHANGELOG.md');
			fs.writeFileSync(changelogPath, '# 📦 Changelog\n\n## [Unreleased]\n\n');

			const customNotes = '### 🚀 Features\n- **core:** ✨ nova funcionalidade de teste';
			const res = await changelog.generate({
				changelogFile: changelogPath,
				version: 'v2.0.0',
				releaseNotes: customNotes,
				enableChangelog: false,
			});

			expect(res.hasChanges).toBe(true);
			expect(res.releaseNotes).toBe(customNotes);

			const written = fs.readFileSync(changelogPath, 'utf-8');
			expect(written).toContain('## [v2.0.0');
			expect(written).toContain(customNotes);

			fs.rmSync(tmpDir, { recursive: true, force: true });
		});
	});
});
