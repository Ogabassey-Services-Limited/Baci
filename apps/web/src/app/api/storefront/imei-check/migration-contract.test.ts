import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('IMEI lookup migration grants', () => {
  it('revokes table-wide authenticated DML and keeps column-scoped grants', () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        '../../supabase/migrations/20260515142500_restrict_imei_lookup_authenticated_grants.sql'
      ),
      'utf8'
    );

    expect(sql).toContain(
      'REVOKE INSERT, UPDATE ON public.imei_lookups FROM authenticated;'
    );
    expect(sql).not.toMatch(
      /GRANT\s+INSERT\s*,\s*UPDATE\s+ON\s+public\.imei_lookups\s+TO\s+authenticated/i
    );
    expect(sql).toMatch(/GRANT\s+INSERT\s*\([\s\S]*idempotency_key[\s\S]*\)/i);
    expect(sql).toMatch(/GRANT\s+UPDATE\s*\([\s\S]*cached_response[\s\S]*\)/i);
  });
});
