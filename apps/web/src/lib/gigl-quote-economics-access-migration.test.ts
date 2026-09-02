import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  '../../supabase/migrations/20260902081234_restrict_gigl_quote_economics_access.sql'
);

describe('GIGL quote economics access migration', () => {
  it('removes the table-wide authenticated read grant', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(
      /REVOKE\s+SELECT\s+ON\s+TABLE\s+public\.shipping_quotes\s+FROM\s+authenticated/i
    );
  });

  it('grants authenticated clients only the non-economic quote projection', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    const grant = sql.match(
      /GRANT\s+SELECT\s*\((?<columns>[\s\S]*?)\)\s+ON\s+TABLE\s+public\.shipping_quotes\s+TO\s+authenticated/i
    )?.groups?.columns;

    expect(grant).toBeDefined();
    expect(grant).not.toMatch(
      /provider_cost|platform_margin|platform_margin_bps|pricing_version/i
    );
    expect(grant).toMatch(/provider_rate_id/);
    expect(grant).toMatch(/quote_request/);
    expect(grant).toMatch(/provider_metadata/);
  });
});
