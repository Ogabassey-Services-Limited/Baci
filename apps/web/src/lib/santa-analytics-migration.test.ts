import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260802090000_record_santa_interaction_rpc.sql'
  ),
  'utf8'
);

describe('Santa analytics RPC migration', () => {
  it('keeps direct anonymous RPC calls behind a database rate limit', () => {
    expect(migration).toContain('public.check_rate_limit');
    expect(migration).toContain("'santa_interaction_rpc'");
    expect(migration).toContain('IF v_rate_allowed IS DISTINCT FROM true THEN');
  });
});
