import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260828090000_harden_storefront_order_rpc_context_and_replays.sql'
  ),
  'utf8'
);

describe('storefront order RPC context migration contract', () => {
  it('requires a signed merchant-bound route context for non-internal inserts', () => {
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION private.enforce_storefront_order_route_context()'
    );
    expect(migration).toContain("'storefront_order_context'");
    expect(migration).toContain("'storefront_order_merchant_id'");
    expect(migration).toContain("'agentic_context'");
    expect(migration).toContain("'storefront_order_route_context_required'");
    expect(migration).toContain('BEFORE INSERT ON public.orders');
  });

  it('marks new orders and exposes only a legacy-version boolean probe', () => {
    expect(migration).toContain(
      'ADD COLUMN IF NOT EXISTS checkout_request_hash_version smallint'
    );
    expect(migration).toContain('NEW.checkout_request_hash_version := 2');
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.is_legacy_storefront_order_idempotency_key('
    );
    expect(migration).toContain('o.checkout_request_hash_version IS NULL');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION');
    expect(migration).toContain('TO anon, authenticated');
  });
});
