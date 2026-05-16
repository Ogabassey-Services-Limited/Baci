import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('IMEI lookup migration grants', () => {
  it('revokes authenticated IMEI lookup writes in the final grant migration', () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        '../../supabase/migrations/20260516120100_revoke_authenticated_imei_lookup_writes.sql'
      ),
      'utf8'
    );

    expect(sql).toContain(
      'REVOKE INSERT, UPDATE ON public.imei_lookups FROM authenticated;'
    );
    expect(sql).not.toMatch(
      /GRANT\s+INSERT\s*,\s*UPDATE\s+ON\s+public\.imei_lookups\s+TO\s+authenticated/i
    );
    expect(sql).toContain(
      'DROP POLICY IF EXISTS "customer_inserts_own_imei_lookups"'
    );
    expect(sql).toContain(
      'DROP POLICY IF EXISTS "customer_updates_own_imei_lookups"'
    );
    expect(sql).not.toMatch(
      /GRANT\s+(?:INSERT|UPDATE)\s*(?:\([^)]*\))?\s+ON\s+public\.imei_lookups\s+TO\s+authenticated/i
    );
  });
});
