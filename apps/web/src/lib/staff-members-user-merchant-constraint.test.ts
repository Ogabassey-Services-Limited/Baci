import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = resolve(
  currentDirectory,
  '../../../../supabase/migrations'
);

function readMigrations(): Array<{ fileName: string; sql: string }> {
  return readdirSync(migrationsDirectory)
    .filter((fileName) => fileName.endsWith('.sql'))
    .map((fileName) => ({
      fileName,
      sql: readFileSync(resolve(migrationsDirectory, fileName), 'utf8'),
    }));
}

describe('staff_members user-merchant uniqueness migration', () => {
  it('adds a real unique constraint for the mobile-onboarding upsert arbiter', () => {
    const migration = readMigrations().find(({ sql }) =>
      sql.includes('staff_members_user_id_merchant_id_key')
    );

    expect(migration?.fileName).toBeDefined();
    if (!migration) {
      throw new Error('staff_members user-merchant migration missing');
    }

    expect(migration.sql).toMatch(
      /ADD\s+CONSTRAINT\s+staff_members_user_id_merchant_id_key\s+UNIQUE\s*\(\s*user_id\s*,\s*merchant_id\s*\)/i
    );
    expect(migration.sql).toMatch(/HAVING\s+COUNT\(\*\)\s*>\s*1/i);
  });
});
