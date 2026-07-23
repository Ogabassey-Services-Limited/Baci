import { describe, expect, it } from 'vitest';
import { parseSupabaseHistoryCaptureArguments } from './parse-supabase-history-capture-arguments';

describe('parseSupabaseHistoryCaptureArguments', () => {
  it('accepts create, verify, effects-refresh, or post-deploy mode', () => {
    expect(parseSupabaseHistoryCaptureArguments([])).toEqual({});
    expect(parseSupabaseHistoryCaptureArguments(['--verify-only'])).toEqual({
      verifyOnly: true,
    });
    expect(
      parseSupabaseHistoryCaptureArguments(['--refresh-effects-fixture'])
    ).toEqual({ refreshEffectsFixture: true });
    expect(
      parseSupabaseHistoryCaptureArguments(['--refresh-post-deploy'])
    ).toEqual({ refreshPostDeploy: true });
  });

  it.each([
    ['--unknown'],
    ['--verify-only', '--verify-only'],
    ['--verify-only', '--refresh-effects-fixture'],
    ['--verify-only', '--refresh-post-deploy'],
    ['--refresh-effects-fixture', '--refresh-post-deploy'],
  ])('rejects an invalid or ambiguous CLI: %s', (...argv) => {
    expect(() => parseSupabaseHistoryCaptureArguments(argv)).toThrow(
      'Invalid Supabase history capture arguments'
    );
  });
});
