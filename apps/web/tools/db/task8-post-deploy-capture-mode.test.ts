import { describe, expect, it, vi } from 'vitest';
import { parseSupabaseHistoryCaptureArguments } from './parse-supabase-history-capture-arguments';
import { persistSupabaseHistoryFixtures } from './persist-supabase-history-fixtures';
import type { ReplayOutput } from './replay-repository-root';

function output(existing: string): ReplayOutput {
  return {
    create: vi.fn(),
    path: `/safe/${existing}.json`,
    read: vi.fn(async (encoding?: BufferEncoding) =>
      encoding ? existing : Buffer.from(existing)
    ),
    remove: vi.fn(),
    replace: vi.fn(),
  };
}

describe('Task 8 post-deploy capture mode', () => {
  it('parses a dedicated mutually-exclusive post-deploy refresh mode', () => {
    expect(
      parseSupabaseHistoryCaptureArguments(['--refresh-post-deploy'])
    ).toEqual({ refreshPostDeploy: true });
    expect(() =>
      parseSupabaseHistoryCaptureArguments([
        '--refresh-post-deploy',
        '--refresh-effects-fixture',
      ])
    ).toThrow('Invalid Supabase history capture arguments');
  });

  it('replaces both linked and effect fixtures in post-deploy mode', async () => {
    const linkedOutput = output('old-linked');
    const effectsOutput = output('old-effects');

    await persistSupabaseHistoryFixtures({
      effectsBody: 'new-effects',
      effectsOutput,
      linkedBody: 'new-linked',
      linkedOutput,
      mode: 'refresh-post-deploy',
    });

    expect(linkedOutput.replace).toHaveBeenCalledWith('new-linked', {
      mode: 0o600,
    });
    expect(effectsOutput.replace).toHaveBeenCalledWith('new-effects', {
      mode: 0o600,
    });
  });

  it('restores linked bytes if the paired effects replacement fails', async () => {
    const linkedOutput = output('old-linked');
    const effectsOutput = output('old-effects');
    vi.mocked(effectsOutput.replace).mockRejectedValueOnce(
      new Error('effects replacement failed')
    );

    await expect(
      persistSupabaseHistoryFixtures({
        effectsBody: 'new-effects',
        effectsOutput,
        linkedBody: 'new-linked',
        linkedOutput,
        mode: 'refresh-post-deploy',
      })
    ).rejects.toThrow('effects replacement failed');

    expect(linkedOutput.replace).toHaveBeenNthCalledWith(2, 'old-linked', {
      mode: 0o600,
    });
  });
});
