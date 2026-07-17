import { describe, expect, it } from 'vitest';
import { parseSupabaseHistoryCaptureArguments } from './parse-supabase-history-capture-arguments';

describe('parseSupabaseHistoryCaptureArguments', () => {
  it('accepts create, verify, or effects-refresh mode', () => {
    expect(parseSupabaseHistoryCaptureArguments([])).toEqual({});
    expect(parseSupabaseHistoryCaptureArguments(['--verify-only'])).toEqual({
      verifyOnly: true,
    });
    expect(
      parseSupabaseHistoryCaptureArguments(['--refresh-effects-fixture'])
    ).toEqual({ refreshEffectsFixture: true });
  });

  it.each([
    ['--unknown'],
    ['--verify-only', '--verify-only'],
    ['--verify-only', '--refresh-effects-fixture'],
  ])('rejects an invalid or ambiguous CLI: %s', (...argv) => {
    expect(() => parseSupabaseHistoryCaptureArguments(argv)).toThrow(
      'Invalid Supabase history capture arguments'
    );
  });
});
