import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    '../../supabase/migrations/20260714100000_add_gateway_payment_wedge_review_type.sql'
  ),
  'utf8'
);

describe('gateway payment wedge review migration', () => {
  it('allows transaction-scoped wedge reviews without collapsing them by order', () => {
    const indexStatement = migration.match(
      /CREATE UNIQUE INDEX CONCURRENTLY[\s\S]*?;/
    )?.[0];

    expect(migration).toContain("'gateway_payment_wedge_requires_review'");
    expect(indexStatement).toContain('issue_type NOT IN');
    expect(indexStatement).toContain("'merchant_settlement_failed'");
    expect(indexStatement).toContain("'gateway_payment_wedge_requires_review'");
    expect(migration).toContain('NOT VALID');
    expect(migration).toContain(
      'VALIDATE CONSTRAINT reconciliation_review_issue_type_check'
    );
  });
});
