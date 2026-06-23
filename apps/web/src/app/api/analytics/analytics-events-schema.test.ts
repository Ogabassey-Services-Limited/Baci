import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testFileDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testFileDir, '../../../../../..');
const migrationsDir = path.join(repoRoot, 'supabase/migrations');
const analyticsEventsMigrationPath = path.join(
  migrationsDir,
  '20260622234105_add_analytics_events_conversion_dedup_index.sql'
);

describe('analytics_events idempotency schema', () => {
  it('has a unique conflict target for conversion/event idempotency upserts', () => {
    expect(existsSync(analyticsEventsMigrationPath)).toBe(true);

    const compactSql = readFileSync(analyticsEventsMigrationPath, 'utf8')
      .replace(/\s+/g, ' ')
      .toLowerCase();

    expect(compactSql).toContain('-- disable-transaction');
    expect(compactSql).toContain(
      'partition by merchant_id, event_id, event_type'
    );
    expect(compactSql).toContain(
      'delete from public.analytics_events as analytics_events using ranked_analytics_events where analytics_events.id = ranked_analytics_events.id and ranked_analytics_events.duplicate_rank > 1;'
    );
    expect(compactSql).toContain(
      'drop index concurrently if exists public.analytics_events_merchant_event_id_type_uidx_next;'
    );
    expect(compactSql).toContain(
      'create unique index concurrently analytics_events_merchant_event_id_type_uidx_next on public.analytics_events (merchant_id, event_id, event_type);'
    );
    expect(compactSql).toContain(
      'drop index concurrently if exists public.analytics_events_merchant_event_id_type_uidx;'
    );
    expect(compactSql).toContain(
      'alter index public.analytics_events_merchant_event_id_type_uidx_next rename to analytics_events_merchant_event_id_type_uidx;'
    );
  });
});
