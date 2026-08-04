import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260804000900_add_agentic_catalog_category_read_policy.sql'
  ),
  'utf8'
);

describe('agentic catalog category-read policy migration', () => {
  it('permits only an authenticated signed agentic context to read active in-tenant memberships', () => {
    expect(migration).toMatch(
      /CREATE\s+POLICY\s+product_categories_agentic_catalog_read/i
    );
    expect(migration).toMatch(/ON\s+public\.product_categories/i);
    expect(migration).toMatch(/FOR\s+SELECT\s+TO\s+authenticated/i);
    expect(migration).toMatch(/public\.is_agentic_checkout_context\(\)/i);
    expect(migration).toMatch(/public\.current_agentic_merchant_id\(\)/i);
    expect(migration).toMatch(
      /product\.merchant_id\s*=\s*category\.merchant_id/i
    );
    expect(migration).toMatch(/product\.status\s*=\s*'active'/i);
    expect(migration).toMatch(/category\.is_active\s+IS\s+TRUE/i);
  });

  it('adds no broad or write-capable policy', () => {
    expect(migration).not.toMatch(/DROP\s+POLICY/i);
    expect(migration).not.toMatch(/FOR\s+(ALL|INSERT|UPDATE|DELETE)/i);
    expect(migration).not.toMatch(/WITH\s+CHECK/i);
  });
});
