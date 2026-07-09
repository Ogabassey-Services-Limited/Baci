import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260709213500_website_performance_event_summary_rpc.sql'
  ),
  'utf8'
).toLowerCase();

describe('website performance event summary migration', () => {
  it('aggregates canonical event shapes without returning raw event rows', () => {
    expect(migration).toContain(
      "event_type in ('search', 'product_view', 'purchase')"
    );
    expect(migration).toContain("event_data ->> 'search_term'");
    expect(migration).toContain('jsonb_array_elements(');
    expect(migration).toContain("event.event_data -> 'items'");
    expect(migration).toContain('count(distinct event_id)');
    expect(migration).toContain('views.view_count >= 10');
    expect(migration).toContain('purchases.purchase_count <= views.view_count');
  });

  it('keeps the rpc merchant scoped and unavailable to anonymous callers', () => {
    expect(migration).toContain('public.has_merchant_access(p_merchant_id)');
    expect(migration).toContain('security definer');
    expect(migration).toContain('from public, anon');
    expect(migration).toContain('to authenticated, service_role');
  });
});
