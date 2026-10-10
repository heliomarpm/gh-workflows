import * as core from '@actions/core';

export const io = {
	getInput(name: string, options?: core.InputOptions): string {
		return core.getInput(name, options);
	},

	getBooleanInput(name: string, options?: core.InputOptions): boolean {
		const val = core.getInput(name, options);
		if (!val && !options?.required) {
			return false;
		}
		return core.getBooleanInput(name, options);
	},

	setOutput(name: string, value: unknown): void {
		const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
		core.setOutput(name, stringValue);
	},

	setFailed(message: string): void {
		core.setFailed(`🚨 ${message}`);
	},

	summary: core.summary,
};
