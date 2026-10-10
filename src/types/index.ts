export interface ParsedCommit {
	hash: string;
	shortHash: string;
	type: string;
	scope?: string;
	description: string;
	body?: string;
	isBreaking: boolean;
	raw: string;
}
