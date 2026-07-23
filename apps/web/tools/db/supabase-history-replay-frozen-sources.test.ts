import { describe, expect, it } from 'vitest';
import { parseFrozenSources } from './supabase-history-replay-frozen-sources';

const SHA = 'a'.repeat(64);

describe('parseFrozenSources', () => {
  it('parses frozen source rows into path-bound sha entries', () => {
    expect(
      parseFrozenSources(
        `\n${SHA} 20260101000000_first.sql\n${SHA} 20260102000000_second.sql\n`
      )
    ).toEqual([
      {
        repositoryPath: 'supabase/migrations/20260101000000_first.sql',
        sha256: SHA,
      },
      {
        repositoryPath: 'supabase/migrations/20260102000000_second.sql',
        sha256: SHA,
      },
    ]);
  });

  it('throws on a frozen source row without a separator', () => {
    expect(() => parseFrozenSources('not-a-valid-row')).toThrow(
      'Invalid frozen replay source row'
    );
  });

  it('throws on a frozen source row with a trailing separator', () => {
    expect(() => parseFrozenSources(`${SHA} `)).toThrow(
      'Invalid frozen replay source row'
    );
  });
});
