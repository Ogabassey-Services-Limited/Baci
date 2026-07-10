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
      "event_type in ('search', 'product_view', 'purchase', 'add_to_cart')"
    );
    expect(migration).toContain("event_data ->> 'search_term'");
    expect(migration).toContain('jsonb_array_elements(');
    expect(migration).toContain("event.event_data -> 'items'");
    expect(migration).toContain('count(distinct event_id)');
    expect(migration).toContain('views.view_count >= 10');
    expect(migration).toContain(
      'least(actions.action_count, views.view_count) as action_count'
    );
  });

  it('keeps the rpc merchant scoped and unavailable to anonymous callers', () => {
    for (const permissionPath of [
      "'*' ->> '*'",
      "'*' ->> 'view'",
      "'analytics' ->> '*'",
      "'analytics' ->> 'view'",
    ]) {
      expect(migration).toContain(`staff.permissions -> ${permissionPath}`);
      expect(migration).toContain(
        `role_permissions.permissions -> ${permissionPath}`
      );
    }
    expect(migration).toContain('security definer');
    expect(migration).toContain('from public, anon');
    expect(migration).toContain('to authenticated, service_role');
  });

  it('enforces the API date-range limit for direct RPC callers', () => {
    expect(migration).toContain(
      "p_end_date - p_start_date > interval '30 days'"
    );
    expect(migration).toContain('website_performance_date_range_too_large');
  });
});
