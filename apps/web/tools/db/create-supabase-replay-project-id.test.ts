import { describe, expect, it } from 'vitest';
import { createSupabaseReplayProjectId } from './create-supabase-replay-project-id';

describe('createSupabaseReplayProjectId', () => {
  it('keeps owned project ids below the Supabase 40-character limit', () => {
    const projectId = createSupabaseReplayProjectId('0123456789abcdef01234567');

    expect(projectId).toBe('baci_replay_0123456789abcdef01234567');
    expect(projectId.length).toBeLessThanOrEqual(40);
  });

  it.each([
    '',
    '0123456789abcdef',
    '0123456789abcdef0123456789',
    '0123456789ABCDEF01234567',
    '0123456789abcdef0123456;',
  ])('rejects invalid entropy without echoing it: %s', (entropyHex) => {
    expect(() => createSupabaseReplayProjectId(entropyHex)).toThrow(
      /^Invalid Supabase replay project entropy$/
    );
  });
});
