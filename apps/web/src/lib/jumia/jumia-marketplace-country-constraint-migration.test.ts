import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath =
  '../../../../../supabase/migrations/20260831120000_align_jumia_marketplace_country_constraint.sql';

describe('Jumia marketplace country constraint migration', () => {
  it('scopes the replacement constraint before the follow-up migration runs', async () => {
    const sql = await readFile(new URL(migrationPath, import.meta.url), 'utf8');

    expect(sql).toMatch(
      /ADD CONSTRAINT marketplace_integrations_country_code_check[\s\S]*CHECK \(\s*platform IS DISTINCT FROM 'jumia'::text/i
    );
    expect(sql).not.toMatch(/CHECK \(\s*country_code\s*=\s*ANY\s*\(/i);
  });
});
