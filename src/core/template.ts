import * as fs from 'node:fs';
import * as path from 'node:path';
import { logger } from './index.js';

const _dirname = __dirname; // path.resolve(__dirname, '../core');

export const template = {
	render(templateContent: string, data: Record<string, string | number | boolean | undefined | null>): string {
		let rendered = templateContent;

		// Interpola datas dinâmicas como {{yyyy-MM-dd}}
		const now = new Date();
		const yyyy = now.getFullYear().toString();
		const MM = (now.getMonth() + 1).toString().padStart(2, '0');
		const dd = now.getDate().toString().padStart(2, '0');
		rendered = rendered.replace(/\{\{yyyy-MM-dd\}\}/g, `${yyyy}-${MM}-${dd}`);
		rendered = rendered.replace(/\{\{yyyy\}\}/g, yyyy);
		rendered = rendered.replace(/\{\{MM\}\}/g, MM);
		rendered = rendered.replace(/\{\{dd\}\}/g, dd);

		// Substitui cada chave nos formatos {{KEY}}
		for (const [key, value] of Object.entries(data)) {
			const stringValue = value !== undefined && value !== null ? String(value) : '';
			const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
			rendered = rendered.replace(regex, stringValue);
		}

		return rendered;
	},

	loadAndRender(templateRelativePath: string, data: Record<string, string | number | boolean | undefined | null>, fallbackContent?: string): string {
		// Procura o template relativo ao root do repositório
		const possiblePaths = [
			path.resolve(_dirname, '../../templates', templateRelativePath),
			path.resolve(_dirname, '../templates', templateRelativePath),
			path.resolve(process.cwd(), 'templates', templateRelativePath),
			path.resolve(process.cwd(), templateRelativePath),
		];

		for (const p of possiblePaths) {
			if (fs.existsSync(p)) {
				try {
					const content = fs.readFileSync(p, 'utf-8');
					return this.render(content, data);
				} catch (err) {
					logger.warning(`Erro ao ler template em '${p}': ${err}`);
				}
			}
		}

		if (fallbackContent) {
			return this.render(fallbackContent, data);
		}

		logger.warning(`Template '${templateRelativePath}' não encontrado em nenhum caminho esperado.`);
		return '';
	},
};
