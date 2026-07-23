import { describe, expect, it } from 'vitest';
import { migration } from './supabase-history-replay-migration-path';

describe('migration', () => {
  it('prefixes migration filenames with the repository migrations path', () => {
    expect(migration('20260101000000_example.sql')).toBe(
      'supabase/migrations/20260101000000_example.sql'
    );
  });
});
