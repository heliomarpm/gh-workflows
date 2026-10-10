import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from './index.js';

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
		// No ESM nativo, resolvemos o diretório atual usando import.meta.url
		const currentDir = path.dirname(fileURLToPath(import.meta.url));
		const repoRoot = path.resolve(currentDir, '..', '..');
		const templatesDirName = String('templates'); //String('templates') para evitar que o @vercel/ncc duplique a pasta para cada dist/<action> no build.
		const repoTemplatesDir = path.join(repoRoot, templatesDirName);
		const cwdTemplatesDir = path.join(process.cwd(), templatesDirName);

		const possiblePaths = [
			// 1. templates/ na raiz do repositório da action
			path.join(repoTemplatesDir, templateRelativePath),
			// 2. Se executando no runner do GitHub Actions via GITHUB_ACTION_PATH (aponta para actions/<action>)
			...(process.env.GITHUB_ACTION_PATH ? [path.resolve(process.env.GITHUB_ACTION_PATH, '..', '..', templatesDirName, templateRelativePath)] : []),
			// 3. templates/ no repositório do chamador (para permitir customização/override)
			path.join(cwdTemplatesDir, templateRelativePath),
			// 4. Caminho relativo direto a partir do cwd
			path.resolve(process.cwd(), templateRelativePath),
		];

		for (const p of possiblePaths) {
			try {
				if (fs.existsSync(p) && fs.statSync(p).isFile()) {
					const content = fs.readFileSync(p, 'utf-8');
					return this.render(content, data);
				}
				logger.debug(`Template '${templateRelativePath}' não encontrado em '${p}'`);
			} catch (err) {
				logger.warning(`Erro ao ler template em '${p}': ${err}`);
			}
		}

		if (fallbackContent) {
			return this.render(fallbackContent, data);
		}

		logger.warning(`Template '${templateRelativePath}' não encontrado em nenhum caminho esperado.`);
		return '';
	},
};
