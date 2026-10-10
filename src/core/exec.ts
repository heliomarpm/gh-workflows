import * as actionExec from '@actions/exec';

export interface ExecResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

export async function runCommand(
	commandLine: string,
	args: string[] = [],
	options: { cwd?: string; silent?: boolean; ignoreReturnCode?: boolean } = {}
): Promise<ExecResult> {
	let stdout = '';
	let stderr = '';

	const exitCode = await actionExec.exec(commandLine, args, {
		cwd: options.cwd,
		silent: options.silent ?? false,
		ignoreReturnCode: options.ignoreReturnCode ?? true,
		listeners: {
			stdout: (data: Buffer) => {
				stdout += data.toString();
			},
			stderr: (data: Buffer) => {
				stderr += data.toString();
			},
		},
	});

	return {
		exitCode,
		stdout: stdout.trim(),
		stderr: stderr.trim(),
	};
}
