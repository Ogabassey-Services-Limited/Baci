import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  resolve(
    __dirname,
    '../../../../../../../supabase/migrations/20260620211259_resolve_storefront_auth_merchant.sql'
  ),
  'utf8'
);

describe('resolve_storefront_auth_merchant migration', () => {
  it('keeps public identifier normalization bounded inside the RPC', () => {
    expect(migrationSql).toMatch(/WHERE\s+p_identifier\s+IS\s+NOT\s+NULL/i);
    expect(migrationSql).toMatch(/octet_length\(p_identifier\)\s*<=\s*254/i);
    expect(migrationSql).toMatch(/SELECT\s+lower\(trim\(p_identifier\)\)/i);
  });

  it('keeps slug and domain merchant lookups in separate indexed branches', () => {
    expect(migrationSql).toMatch(
      /slug_match\s+AS\s*\([\s\S]*m\.slug\s*=\s*input\.identifier/i
    );
    expect(migrationSql).toMatch(
      /domain_match\s+AS\s*\([\s\S]*JOIN\s+public\.merchants\s+AS\s+m\s+ON\s+m\.id\s*=\s*md\.merchant_id/i
    );
    expect(migrationSql).not.toMatch(
      /WHERE[\s\S]{0,120}m\.slug\s*=\s*input\.identifier[\s\S]{0,120}OR[\s\S]{0,120}md\.merchant_id\s+IS\s+NOT\s+NULL/i
    );
  });
});
