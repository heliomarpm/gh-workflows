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
};
