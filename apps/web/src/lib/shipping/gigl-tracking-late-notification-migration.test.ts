import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function resolveMigrationPath(relativePath: string) {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

function readMigration(filename: string) {
  return readFileSync(
    resolveMigrationPath(`../../../../../supabase/migrations/${filename}`),
    'utf8'
  );
}

describe('GIGL late notification migration', () => {
  it('suppresses late milestones after newer delivery', () => {
    const migration = readMigration(
      '20260801130200_suppress_late_gigl_tracking_notifications.sql'
    );

    for (const requirement of [
      'CREATE OR REPLACE FUNCTION private.suppress_late_gigl_tracking_notifications()',
      "stale.status = 'pending'",
      "newer.status IN ('pending', 'processing', 'sent')",
      'newer_event.occurred_at > stale_event.occurred_at',
      "stale_event.provider = 'GIGL'",
      'AFTER INSERT ON public.shipment_tracking_notification_outbox',
    ]) {
      expect(migration).toContain(requirement);
    }
  });

  it('resets the unchanged poll counter when a paused monitor is claimed', () => {
    const migration = readMigration(
      '20260801130400_reset_gigl_tracking_cooldown_counter.sql'
    );

    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.claim_due_gigl_tracking_monitors('
    );
    expect(migration).toContain("WHEN monitor.state = 'paused' THEN 0");
  });

  it('locks only notification outbox rows while claiming dispatch work', () => {
    const migration = readMigration(
      '20260801130500_lock_only_gigl_notification_outbox.sql'
    );

    expect(migration).toContain(
      'LIMIT p_limit FOR UPDATE OF outbox SKIP LOCKED'
    );
  });

  it('uses the insert transition table and concurrent index rebuild', () => {
    const migration = readMigration(
      '20260801130600_bound_late_gigl_notification_suppression.sql'
    );

    expect(migration).toMatch(/^-- disable-transaction(?:\r?\n|$)/);
    expect(migration).toContain('CREATE INDEX CONCURRENTLY IF NOT EXISTS');
    expect(migration).toContain('REFERENCING NEW TABLE AS inserted_outbox');
    expect(migration).toContain('inserted_outbox AS newer');
  });

  it('suppresses unstarted processing notifications after newer events', () => {
    const migration = readMigration(
      '20260801130700_suppress_unstarted_gigl_notification_claims.sql'
    );

    expect(migration).toContain("stale.status = 'processing'");
    expect(migration).toContain('stale.delivery_started_at IS NULL');
    expect(migration).toContain('inserted_outbox AS newer');
  });

  it('preserves shipped orders across retryable GIGL failures', () => {
    const migration = readMigration(
      '20260801130800_preserve_retryable_gigl_order_status.sql'
    );

    expect(migration).toContain("NEW.status IS DISTINCT FROM 'failed'");
    expect(migration).toContain(
      "orders.shipping_status NOT IN ('shipped', 'delivered')"
    );
    expect(migration).toContain('RETURN NEW;');
  });

  it('preserves delivered status across stale terminal scans', () => {
    const migration = readMigration(
      '20260801130300_preserve_delivered_gigl_status.sql'
    );

    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.apply_gigl_tracking_result('
    );
    expect(migration).toContain(
      "v_current_status IN ('delivered', 'cancelled', 'returned')"
    );
    expect(migration).toContain(
      "p_status IN ('cancelled', 'failed', 'returned')"
    );
    expect(migration).toContain(
      'v_latest_incoming_event_at <= v_latest_persisted_event_at'
    );
    expect(migration).toContain('private.gigl_tracking_status_rank(p_status)');
  });
});
