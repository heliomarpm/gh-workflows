import type { ParsedCommit } from '../types/index.js';

const SECTION_HEADERS: { type: string; title: string; regex: RegExp }[] = [
	{ type: 'breaking', title: '💥 Breaking Changes', regex: /^(?:.*!|BREAKING CHANGE:)/ },
	{ type: 'feat', title: '🚀 Features', regex: /^feat(?:\(.*\))?:/ },
	{ type: 'fix', title: '🐛 Bug Fixes', regex: /^fix(?:\(.*\))?:/ },
	{ type: 'perf', title: '⚡ Performance Improvements', regex: /^perf(?:\(.*\))?:/ },
	{ type: 'refactor', title: '♻️ Code Refactoring', regex: /^refactor(?:\(.*\))?:/ },
	{ type: 'docs', title: '📝 Documentation', regex: /^docs(?:\(.*\))?:/ },
	{ type: 'test', title: '✅ Tests', regex: /^test(?:\(.*\))?:/ },
	{ type: 'ci', title: '👷 CI & Build System', regex: /^(?:ci|build)(?:\(.*\))?:/ },
	{ type: 'chore', title: '🔧 Miscellaneous', regex: /^chore(?:\(.*\))?:/ },
	{ type: 'revert', title: '⏪ Reverts', regex: /^revert(?:\(.*\))?:/ },
];

export const commits = {
	parseCommitLine(rawCommit: string): ParsedCommit | null {
		// Espera formato HASH\x1fSHORT_HASH\x1fSUBJECT\x1fBODY
		const parts = rawCommit.split('\x1f');
		if (parts.length < 3) {
			return null;
		}

		const [hash, shortHash, subject, body = ''] = parts;
		const isBreaking = subject.includes('!') || body.includes('BREAKING CHANGE');

		// Filtra commits ruído (merge, chore release, chore changelog, skip ci)
		if (
			subject.startsWith('Merge pull request') ||
			subject.startsWith('Merge branch') ||
			/^chore\((?:release|changelog)\):/i.test(subject) ||
			subject.includes('[skip ci]')
		) {
			return null;
		}

		const match = subject.match(/^([a-zA-Z]+)(?:\(([^)]+)\))?(!)?:\s*(.*)$/);
		if (match) {
			return {
				hash,
				shortHash,
				type: match[1].toLowerCase(),
				scope: match[2],
				description: match[4] || subject,
				body,
				isBreaking,
				raw: subject,
			};
		}

		return {
			hash,
			shortHash,
			type: 'other',
			description: subject,
			body,
			isBreaking,
			raw: subject,
		};
	},

	buildReleaseNotes(commits: ParsedCommit[], repoUrl?: string): string {
		const sections: Record<string, string[]> = {};

		for (const commit of commits) {
			let commitLink = `(${commit.shortHash})`;
			if (repoUrl) {
				commitLink = `([${commit.shortHash}](${repoUrl}/commit/${commit.hash}))`;
			}

			const scopePrefix = commit.scope ? `**${commit.scope}:** ` : '';
			const entry = `- ${scopePrefix}${commit.description} ${commitLink}`;

			if (commit.isBreaking) {
				sections['💥 Breaking Changes'] = sections['💥 Breaking Changes'] || [];
				sections['💥 Breaking Changes'].push(entry);
			}

			let matchedHeader = SECTION_HEADERS.find((h) => h.type === commit.type)?.title;
			if (!matchedHeader) {
				matchedHeader = '📦 Other Changes';
			}

			sections[matchedHeader] = sections[matchedHeader] || [];
			sections[matchedHeader].push(entry);
		}

		const lines: string[] = [];
		for (const header of SECTION_HEADERS) {
			const items = sections[header.title];
			if (items && items.length > 0) {
				lines.push(`### ${header.title}`);
				lines.push(...items);
				lines.push('');
			}
		}

		if (sections['📦 Other Changes'] && sections['📦 Other Changes'].length > 0) {
			lines.push('### 📦 Other Changes');
			lines.push(...sections['📦 Other Changes']);
			lines.push('');
		}

		return lines.join('\n').trim();
	}
}