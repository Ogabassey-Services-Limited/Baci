import * as fs from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDirectory = resolve(
  __dirname,
  '../../../../supabase/migrations'
);

function readLatestCustomerFullNameTriggerMigration(
  fileNames = fs.readdirSync(migrationsDirectory)
) {
  const migration = fileNames
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort()
    .map((fileName) => ({
      fileName,
      sql: fs.readFileSync(resolve(migrationsDirectory, fileName), 'utf8'),
    }))
    .reverse()
    .find(({ sql }) =>
      /create\s+or\s+replace\s+function\s+public\.update_customer_full_name\(\)/i.test(
        sql
      )
    );

  if (!migration) {
    throw new Error('update_customer_full_name migration not found');
  }

  return migration;
}

describe('customer full-name trigger migration', () => {
  it('throws when no customer full-name trigger migration exists', () => {
    expect(() => readLatestCustomerFullNameTriggerMigration([])).toThrow(
      'update_customer_full_name migration not found'
    );
  });

  it('preserves fallback full names for individual customers without first or last names', () => {
    const { fileName, sql } = readLatestCustomerFullNameTriggerMigration();
    const normalizedSql = sql.replace(/\s+/g, ' ');

    expect(fileName).toBe(
      '20260703190000_preserve_customer_full_name_fallback.sql'
    );
    expect(normalizedSql).toMatch(/coalesce\( nullif\(/i);
    expect(normalizedSql).toMatch(
      /nullif\(btrim\(coalesce\(new\.full_name,\s*''\)\),\s*''\)/i
    );
    expect(normalizedSql).toMatch(
      /split_part\(coalesce\(new\.email,\s*''\),\s*'@',\s*1\)/i
    );
  });
});
