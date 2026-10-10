import * as core from '@actions/core';

export const logger = {
	info(message: string): void {
		core.info(`→ ${message}`);
	},

	success(message: string): void {
		core.info(`✅ ${message}`);
	},

	warning(message: string): void {
		core.warning(`⚠️ ${message}`);
	},

	error(message: string): void {
		core.error(`❌ ${message}`);
	},

	debug(message: string): void {
		core.debug(`🔍 ${message}`);
	},

	startGroup(name: string): void {
		core.startGroup(name);
	},

	endGroup(): void {
		core.endGroup();
	},

	setFailed(message: string): void {
		core.setFailed(`🚨 ${message}`);
	},

	setOutput(name: string, value: unknown): void {
		const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
		core.setOutput(name, stringValue);
	},

	getInput(name: string, options?: core.InputOptions): string {
		return core.getInput(name, options);
	},

	getBooleanInput(name: string, options?: core.InputOptions): boolean {
		return core.getBooleanInput(name, options);
	},

	summary: core.summary,
};
