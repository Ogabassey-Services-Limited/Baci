import {
  formatBoundedSubprocessOutput,
  redactCodexError,
} from './remediation-codex-output.mjs';

export function runRemediationChecked(command, args, options) {
  const result = options.runner(command, args, {
    cwd: options.cwd,
    env: options.env,
    shell: options.shell || false,
    timeout: options.timeout,
  });
  if (result.error) throw redactCodexError(result.error);
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed: ${formatBoundedSubprocessOutput(result)}`
    );
  }
  return result.stdout || '';
}
