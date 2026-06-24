import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationSql = readFileSync(
  resolve(
    currentDirectory,
    '../../../../../supabase/migrations/20260623191507_merchant_auth_recovery_codes.sql'
  ),
  'utf8'
);

describe('merchant recovery-code migration contract', () => {
  it('enforces account-level lockout before reserving a recovery attempt', () => {
    expect(migrationSql).toMatch(/account_failure_count\s+integer/i);
    expect(migrationSql).toMatch(
      /WHERE\s+user_id\s*=\s*p_user_id\s+AND\s+code_set_id\s*=\s*p_code_set_id\s+AND\s+succeeded\s*=\s*false\s+AND\s+created_at\s*>=\s*p_cutoff/is
    );
    expect(migrationSql).toMatch(
      /IF\s+account_failure_count\s*>=\s*p_max_failures\s+THEN\s+RETURN\s+NULL/is
    );
  });

  it('keeps per-IP throttling in addition to subscriber-account throttling', () => {
    expect(migrationSql).toMatch(/ip_failure_count\s+integer/i);
    expect(migrationSql).toMatch(
      /AND\s+ip_hash\s+IS\s+NOT\s+DISTINCT\s+FROM\s+p_ip_hash/is
    );
  });

  it('inserts a replacement saved code in the same claim transaction', () => {
    expect(migrationSql).toMatch(/p_replacement_code_hash\s+text/i);
    expect(migrationSql).toMatch(/replacement_code_hash_required/i);
    expect(migrationSql).toMatch(
      /INSERT\s+INTO\s+public\.merchant_auth_recovery_codes\s*\(\s*user_id,\s*code_set_id,\s*code_hash\s*\)\s*VALUES\s*\(\s*p_user_id,\s*p_code_set_id,\s*p_replacement_code_hash\s*\)/is
    );
  });
});
