import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationSql = readFileSync(
  resolve(
    currentDirectory,
    '../../../../supabase/migrations/20260527064800_quiz_time_limit_unqualified_least_greatest.sql'
  ),
  'utf8'
);

describe('quiz time limit RPC migration', () => {
  it('rewrites start and answer RPC time-limit clamps away from pg_catalog.greatest', () => {
    expect(migrationSql).toMatch(
      /public\.start_quiz_attempt\(uuid,text,jsonb,uuid\)/i
    );
    expect(migrationSql).toMatch(
      /public\.submit_quiz_answer\(uuid,uuid,text,timestamp with time zone,text,jsonb,uuid\)/i
    );
    expect(migrationSql).toMatch(/pg_catalog\.replace\(/i);
    expect(migrationSql).toMatch(/LEAST\(GREATEST\(/);
    expect(migrationSql).not.toMatch(
      /'pg_catalog\.least\(pg_catalog\.greatest\(',\s*'pg_catalog/i
    );
  });
});
