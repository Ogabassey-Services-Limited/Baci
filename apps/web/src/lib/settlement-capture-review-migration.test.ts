import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  process.cwd(),
  '../../supabase/migrations/20260714090000_add_merchant_settlement_failed_review_type.sql'
);

describe('merchant settlement failure review migration', () => {
  it('adds and validates the review type outside the initial constraint definition', () => {
    const exists = existsSync(migrationPath);
    expect(exists).toBe(true);
    if (!exists) return;

    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain("'merchant_settlement_failed'");
    expect(sql).toContain('NOT VALID');
    expect(sql).toContain(
      'VALIDATE CONSTRAINT reconciliation_review_issue_type_check'
    );
  });
});
