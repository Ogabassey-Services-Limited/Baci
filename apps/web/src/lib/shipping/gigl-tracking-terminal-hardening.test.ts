import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function readMigration(filename: string) {
  const modulePath = fileURLToPath(import.meta.url).replace(/^\/@fs(?=\/)/, '');
  return readFileSync(
    resolve(
      dirname(modulePath),
      `../../../../../supabase/migrations/${filename}`
    ),
    'utf8'
  );
}

function readMigrationTest(filename: string) {
  const modulePath = fileURLToPath(import.meta.url).replace(/^\/@fs(?=\/)/, '');
  return readFileSync(
    resolve(
      dirname(modulePath),
      `../../../../../supabase/migrations/tests/${filename}`
    ),
    'utf8'
  );
}

describe('GIGL terminal tracking hardening', () => {
  it('invalidates older milestones across audiences for terminal events', () => {
    const migration = readMigration(
      '20260802000100_suppress_cross_audience_gigl_terminal_notifications.sql'
    );
    const sqlRegression = readMigrationTest(
      'gigl_tracking_notification_audience.sql'
    );

    expect(migration).toContain(
      "newer_event.normalized_status IN ('delivered', 'cancelled', 'returned')"
    );
    expect(migration).toContain("newer.status = 'skipped'");
    expect(sqlRegression).toContain('SELECT plan(2);');
    expect(sqlRegression).toContain('IF EXISTS (');
    expect(sqlRegression).toContain('IF NOT EXISTS (');
    expect(sqlRegression).toContain(
      'WHERE tracking_event_id = v_stale_event_id'
    );
    expect(sqlRegression).toContain("'cancelled', 'Cancelled'");
    expect(sqlRegression).toContain("'pickup_scheduled', 'Pickup scheduled'");
  });

  it('does not regress a manually terminal order from carrier progress', () => {
    const migration = readMigration(
      '20260802000200_preserve_manual_gigl_order_terminal_status.sql'
    );
    const sqlRegression = readMigrationTest(
      'gigl_tracking_order_status_generation.sql'
    );
    const normalizedMigration = migration.replace(/\s+/g, ' ');

    expect(normalizedMigration).toContain(
      "orders.shipping_status NOT IN ( 'delivered', 'completed', 'cancelled', 'canceled', 'returned', 'failed' )"
    );
    expect(migration).toContain(
      "v_shipping_status IN ('delivered', 'cancelled', 'failed', 'returned')"
    );
    expect(sqlRegression).toContain("SET shipping_status = 'delivered'");
    expect(sqlRegression).toContain(
      "SET status = 'in_transit', last_tracked_at = now()"
    );
    expect(sqlRegression).toContain(
      "IF v_order_status IS DISTINCT FROM 'delivered' THEN"
    );
  });

  it('invalidates monitors when an order changes merchant', () => {
    const migration = readMigration(
      '20260802000300_revalidate_gigl_monitor_order_tenant.sql'
    );
    const sqlRegression = readMigrationTest(
      'gigl_tracking_order_status_generation.sql'
    );

    expect(migration).toContain('AFTER UPDATE OF merchant_id ON public.orders');
    expect(migration).toContain(
      'shipment.merchant_id IS DISTINCT FROM NEW.merchant_id'
    );
    expect(migration).toContain("skip_reason = 'tracking_tenant_changed'");
    expect(sqlRegression).toContain('SET merchant_id = v_attacker_merchant_id');
    expect(sqlRegression).toContain(
      "IF v_monitor_state IS DISTINCT FROM 'inactive' THEN"
    );
  });

  it('repairs existing tenant mismatches and revalidates both update orders', () => {
    const migration = readMigration(
      '20260802000500_repair_gigl_monitor_tenant_revalidation.sql'
    );
    const sqlRegression = readMigrationTest(
      'gigl_tracking_order_status_generation.sql'
    );

    expect(migration).toContain("last_error = 'tracking_tenant_changed'");
    expect(migration).toContain(
      'AFTER UPDATE OF merchant_id ON public.shipments'
    );
    expect(migration).toContain(
      "monitor.last_error = 'tracking_tenant_changed'"
    );
    expect(migration).toContain(
      'Re-apply the ownership cleanup for monitors that predate the order trigger'
    );
    expect(sqlRegression).toContain(
      'returning an order to its shipment tenant must reactivate its GIGL monitor'
    );
    expect(sqlRegression).toContain(
      'moving shipment after its order must reactivate the owned GIGL monitor'
    );
    expect(sqlRegression).toContain(
      'moving order before shipment must still reactivate the owned GIGL monitor'
    );
  });

  it('keeps tenant revalidation eligible and selects one newest monitor', () => {
    const migration = readMigration(
      '20260802000600_harden_gigl_monitor_tenant_revalidation.sql'
    );
    const sqlRegression = readMigrationTest(
      'gigl_tracking_order_status_generation.sql'
    );

    expect(migration).toContain("NEW.provider IS DISTINCT FROM 'GIGL'");
    expect(migration).toContain(
      "NULLIF(btrim(NEW.tracking_number), '') IS NULL"
    );
    expect(migration).toContain(
      'candidate_shipment.tracking_timeline_generation DESC'
    );
    expect(migration).toContain('candidate_shipment.created_at DESC');
    expect(sqlRegression).toContain("provider = 'TOPSHIP'");
    expect(sqlRegression).toContain(
      'tenant recovery must reactivate only the newest GIGL monitor per order'
    );
    expect(sqlRegression).toContain(
      'an ineligible combined shipment update must not reactivate a GIGL monitor'
    );
  });

  it('preserves manually completed orders across carrier terminal updates', () => {
    const migration = readMigration(
      '20260802000400_preserve_completed_gigl_order_status.sql'
    );
    const sqlRegression = readMigrationTest(
      'gigl_tracking_order_status_generation.sql'
    );

    expect(migration).toContain(
      "orders.shipping_status IS DISTINCT FROM 'completed'"
    );
    expect(sqlRegression).toContain("SET shipping_status = 'completed'");
    expect(sqlRegression).toContain(
      'a manually completed GIGL order must remain terminal'
    );
  });
});
