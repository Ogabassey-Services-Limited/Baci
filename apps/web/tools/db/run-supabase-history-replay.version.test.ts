import { describe, expect, it, vi } from 'vitest';
import { runSupabaseHistoryReplay } from './run-supabase-history-replay';
import { createSupabaseReplayRuntimeFixture } from './run-supabase-history-replay-test-runtime';

describe('runSupabaseHistoryReplay server version validation', () => {
  it('verifies effects before rejecting a mismatched server version', async () => {
    const fixture = createSupabaseReplayRuntimeFixture();
    const stages: string[] = [];
    const verifyEffects = fixture.deps.verifyEffects;
    fixture.deps.verifyEffects = vi.fn(async (options) => {
      stages.push('effects');
      return verifyEffects(options);
    });
    const createCommand = fixture.deps.createCommand;
    fixture.deps.createCommand = (root) => {
      const run = createCommand(root);
      return async (command, args, options) => {
        if (args.includes('SHOW server_version_num')) {
          stages.push('version');
          return { stderr: '', stdout: '160000\n' };
        }
        return run(command, args, options);
      };
    };

    await expect(
      runSupabaseHistoryReplay(fixture.replayOptions(), fixture.deps)
    ).rejects.toThrow('Local server version mismatch');

    expect(stages).toEqual(['effects', 'version']);
  });
});
