import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ROOT_DOMAIN } from './default-root-domain';

const migrationSql = readFileSync(
  join(
    process.cwd(),
    '../../supabase/migrations/20260728091958_provision_mobile_merchant_v2.sql'
  ),
  'utf8'
);

describe('mobile merchant root-domain contract', () => {
  it('pins the SQL platform domain to the web default root domain', () => {
    const rootDomain = migrationSql.match(
      /v_root_domain\s+CONSTANT\s+text\s*:=\s*'([^']+)'/i
    )?.[1];

    expect(rootDomain).toBe(DEFAULT_ROOT_DOMAIN);
  });

  it('does not accept a root-domain argument from the caller', () => {
    expect(migrationSql).not.toMatch(/\bp_root_domain\b/i);
  });
});
