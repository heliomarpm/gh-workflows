export type BumpType = 'major' | 'minor' | 'patch' | 'none';

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

export type RollbackStrategy = 'revert' | 'redeploy' | 'delete-tag';
export type RollbackStatus = 'success' | 'failed' | 'aborted';

export interface RollbackOptions {
	strategy: RollbackStrategy;
	targetVersion?: string;
	allowDestructive?: boolean;
	dryRun?: boolean;
	githubToken?: string;
}

export interface RollbackResult {
	strategy: RollbackStrategy;
	targetVersion: string;
	targetCommit: string;
	status: RollbackStatus;
	newVersion?: string;
	errorMessage?: string;
	conflictedFiles?: string[];
}
