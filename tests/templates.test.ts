import { describe, expect, it } from 'vitest';
import { template } from '../src/core/index.js';

describe('template.render', () => {
	it('substitui variáveis simples no formato {{KEY}}', () => {
		const msg = 'Olá, {{NAME}}! Seu status é {{STATUS}}.';
		const result = template.render(msg, {
			NAME: 'Antigravity',
			STATUS: 'aprovado',
		});

		expect(result).toBe('Olá, Antigravity! Seu status é aprovado.');
	});

	it('substitui tokens de data {{yyyy-MM-dd}}', () => {
		const msg = 'Relatório gerado em: {{yyyy-MM-dd}}';
		const result = template.render(msg, {});
		const now = new Date();
		const expectedYear = now.getFullYear().toString();

		expect(result).toContain(expectedYear);
		expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
	});

	it('trata valores vazios e nulos com string vazia', () => {
		const msg = 'Item: [{{VAL}}]';
		const result = template.render(msg, { VAL: undefined });

		expect(result).toBe('Item: []');
	});
});

describe('template.loadAndRender', () => {
	it('carrega e renderiza template da raiz templates/ com sucesso', () => {
		const result = template.loadAndRender('summary-changelog-skipped.md', {
			CURRENT_BRANCH: 'main',
			CHANGELOG_FILE: 'CHANGELOG.md',
			MODE: 'skip',
			COMMITS_COUNT: 0,
			SINCE_LABEL: 'v1.0.0',
		});

		expect(result).toContain('main');
		expect(result).toContain('Changelog: Nenhuma Nova Alteração');
	});

	it('retorna fallbackContent quando o template não existe', () => {
		const result = template.loadAndRender('template-inexistente.md', { MSG: 'fallback ativo' }, 'Aviso: {{MSG}}');

		expect(result).toBe('Aviso: fallback ativo');
	});

	it('retorna string vazia quando o arquivo não existe e não há fallback', () => {
		const result = template.loadAndRender('template-inexistente.md', {});

		expect(result).toBe('');
	});
});
