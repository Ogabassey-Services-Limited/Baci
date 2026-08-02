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
});
