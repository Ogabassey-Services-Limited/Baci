import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { supabaseHistoryEffectQueryContract } from './supabase-history-effect-query-contract';

const sha256 = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');

describe('supabaseHistoryEffectQueryContract', () => {
  it('binds the exact reviewed query and scope-manifest bytes', async () => {
    const query = await readFile(
      path.join(import.meta.dirname, 'supabase-history-effects.sql')
    );
    const scope = await readFile(
      path.join(import.meta.dirname, 'supabase-history-effect-scope.ts')
    );
    expect(sha256(query)).toBe(supabaseHistoryEffectQueryContract.querySha256);
    expect(sha256(scope)).toBe(
      supabaseHistoryEffectQueryContract.scopeManifestSha256
    );
    expect(supabaseHistoryEffectQueryContract.scopeVersion).toBe(
      'baci-p0-effects-v3'
    );
  });

  it('is immutable', () => {
    expect(Object.isFrozen(supabaseHistoryEffectQueryContract)).toBe(true);
  });
});
