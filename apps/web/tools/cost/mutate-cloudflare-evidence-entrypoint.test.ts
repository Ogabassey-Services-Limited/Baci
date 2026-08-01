import { describe, expect, it, vi } from 'vitest';
import { runMutationCli } from './mutate-cloudflare-evidence-entrypoint';

describe('mutation CLI entrypoint', () => {
  it('fails closed when the run-state directory is missing', async () => {
    const stderr: string[] = [];
    const setExitCode = vi.fn();
    const command = vi.fn();
    await runMutationCli(
      ['--run', '0123456789abcdef0123456789abcdef', '--apply'],
      {},
      {
        stdout: () => undefined,
        stderr: (value) => stderr.push(value),
        setExitCode,
      },
      command
    );
    expect(stderr).toEqual(['absolute EVIDENCE_RUN_STATE_DIR is required\n']);
    expect(setExitCode).toHaveBeenCalledWith(1);
    expect(command).not.toHaveBeenCalled();
  });
});
