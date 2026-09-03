import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  `${process.cwd()}/../../supabase/migrations/20260903126000_persist_refreshed_merchant_shipping_quote.sql`,
  'utf8'
);

describe('authenticated refreshed quote persistence', () => {
  it('grants the merchant-owned RPC to authenticated callers only', () => {
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.persist_refreshed_merchant_shipping_quote('
    );
    expect(sql).toContain('merchant.user_id = auth.uid()');
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.persist_refreshed_merchant_shipping_quote(jsonb)'
    );
    expect(sql).toContain('TO authenticated');
    expect(sql).not.toContain('createAdminClient');
  });
});
