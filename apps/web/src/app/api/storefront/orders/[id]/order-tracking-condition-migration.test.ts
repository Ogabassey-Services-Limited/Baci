import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  join(
    process.cwd(),
    '../../supabase/migrations/20260627164247_include_order_item_condition_in_tracking_rpc.sql'
  ),
  'utf8'
);

describe('order tracking condition migration', () => {
  it('adds order item condition to the public tracking RPC item payload', () => {
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_order_tracking/i
    );
    expect(migrationSql).toMatch(
      /jsonb_build_object\([\s\S]*'condition', oi\.condition,[\s\S]*'variant_name', oi\.variant_name/i
    );
  });

  it('returns tracking RPC order items in a stable order', () => {
    expect(migrationSql).toMatch(
      /jsonb_agg\([\s\S]*ORDER BY oi\.line_id NULLS LAST, oi\.id/i
    );
  });
});
