import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260901191000_stamp_gigl_order_economics.sql'
  ),
  'utf8'
);

describe('GIGL order economics migration contract', () => {
  it('adds the nullable snapshot columns and constrained funding source', () => {
    for (const column of [
      'shipping_funding_source',
      'shipping_provider_cost',
      'shipping_platform_margin',
      'shipping_platform_retained_amount',
      'shipping_pricing_version',
    ]) {
      expect(migration).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
    }
    expect(migration).toContain("IN ('customer_checkout', 'merchant_wallet')");
  });

  it('stamps only matching newly priced GIGL quotes and preserves legacy nulls', () => {
    expect(migration).toContain(
      "v_pricing_version IS DISTINCT FROM 'gigl_platform_margin_v1'"
    );
    expect(migration).toContain(
      "upper(pg_catalog.btrim(COALESCE(v_provider, ''))) <> 'GIGL'"
    );
    expect(migration).toContain('sq.merchant_id = NEW.merchant_id');
    expect(migration).toContain(
      "NEW.shipping_funding_source := 'customer_checkout'"
    );
    expect(migration).toContain(
      "WHEN NEW.shipping_funding_source = 'customer_checkout' THEN v_price"
    );
  });

  it('makes merchant wallet authoritative and does not mutate order totals', () => {
    expect(migration).toContain('NEW.shipping_platform_retained_amount := 0');
    expect(migration).toContain('ELSE 0');
    expect(migration).not.toMatch(/NEW\.(shipping_fee|subtotal|total)\s*:=/);
    expect(migration).toContain(
      'BEFORE INSERT OR UPDATE OF selected_quote_id, shipping_funding_source'
    );
  });

  it.each([
    'IF NEW.selected_quote_id IS NULL THEN',
    'IF NOT FOUND OR',
    "upper(pg_catalog.btrim(COALESCE(v_provider, ''))) <> 'GIGL'",
    "v_pricing_version IS DISTINCT FROM 'gigl_platform_margin_v1'",
  ])('clears caller-supplied economics before ineligible return (%s)', (marker) => {
    expect(migration).toContain(marker);
    expect(migration).toContain('NEW.shipping_funding_source := NULL');
    expect(migration).toContain('NEW.shipping_provider_cost := NULL');
    expect(migration).toContain('NEW.shipping_platform_margin := NULL');
    expect(migration).toContain('NEW.shipping_pricing_version := NULL');
    expect(migration).toContain('NEW.shipping_platform_retained_amount := 0');
  });
});
