import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = resolve(
  currentDirectory,
  '../../../../supabase/migrations'
);
const migrationFileName = '20260517200500_lock_established_merchant_slugs.sql';

function readMigration(fileName: string) {
  return readFileSync(resolve(migrationsDirectory, fileName), 'utf8');
}

function listMigrationFiles() {
  return readdirSync(migrationsDirectory)
    .filter((fileName) => /^\d+_.+\.sql$/.test(fileName))
    .sort();
}

describe('merchant slug immutability migration', () => {
  it('installs the database guard that blocks established slug changes', () => {
    const sql = readMigration(migrationFileName);

    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.prevent_established_merchant_slug_change()'
    );
    expect(sql).toContain('OLD.slug IS NOT NULL');
    expect(sql).toContain("btrim(OLD.slug) <> ''");
    expect(sql).toContain('NEW.slug IS DISTINCT FROM OLD.slug');
    expect(sql).toContain("MESSAGE = 'merchant_slug_immutable'");
    expect(sql).toContain(
      'CREATE TRIGGER zz_prevent_established_merchant_slug_change'
    );
    expect(sql).toContain('BEFORE UPDATE ON public.merchants');
  });

  it('keeps the latest immutability function definition fail-closed', () => {
    const effectiveDefinition = listMigrationFiles()
      .map((fileName) => ({ fileName, sql: readMigration(fileName) }))
      .filter(({ sql }) =>
        sql.includes(
          'CREATE OR REPLACE FUNCTION public.prevent_established_merchant_slug_change()'
        )
      )
      .at(-1);

    expect(effectiveDefinition?.fileName).toBe(migrationFileName);
    expect(effectiveDefinition?.sql).toContain(
      'NEW.slug IS DISTINCT FROM OLD.slug'
    );
    expect(effectiveDefinition?.sql).toContain('merchant_slug_immutable');
  });

  it('ships an executable SQL regression test for real database resets', () => {
    const sql = readFileSync(
      resolve(migrationsDirectory, 'tests/merchant_slug_immutability.sql'),
      'utf8'
    );

    expect(sql).toContain("SET slug = 'changed-slug'");
    expect(sql).toContain('SET slug = NULL');
    expect(sql).toContain("changed_message <> 'merchant_slug_immutable'");
    expect(sql).toContain("cleared_message <> 'merchant_slug_immutable'");
    expect(sql).toContain(
      'pending merchant did not receive initial generated slug'
    );
    expect(sql).toContain('ROLLBACK;');
  });
});
