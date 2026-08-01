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

describe('GIGL tracking follow-up hardening migrations', () => {
  it('suppresses late notifications in either insertion order', () => {
    const migration = readMigration(
      '20260801130900_repair_gigl_notification_ordering.sql'
    );

    expect(migration).toContain('inserted_outbox AS newer');
    expect(migration).toContain('inserted_outbox AS inserted_stale');
    expect(migration).toContain('stale.id = inserted_stale.id');
    expect(migration).toContain('REFERENCING NEW TABLE AS inserted_outbox');
  });

  it('preserves delivery metadata and filters contradictory terminal pushes', () => {
    const migration = readMigration(
      '20260801131000_preserve_gigl_delivery_metadata.sql'
    );

    for (const requirement of [
      'v_existing_delivered_at timestamptz',
      'v_should_update_delivery boolean',
      'v_latest_status_event_at timestamptz',
      'p_actual_delivery >= v_existing_delivered_at',
      "entry.event->>'normalized_status' = p_status",
      'event.normalized_status = v_effective_status',
      'delivered_at = CASE',
    ]) {
      expect(migration).toContain(requirement);
    }
  });

  it('keeps unknown-status monitors retryable', () => {
    const migration = readMigration(
      '20260801131100_retry_gigl_unknown_status.sql'
    );

    expect(migration).toContain("SET state = 'paused'");
    expect(migration).toContain("next_poll_at = now() + interval '15 minutes'");
    expect(migration).toContain('locked_at = NULL');
  });

  it('keeps stale tracking updates chronological and tenant-scoped', () => {
    const statusMigration = readMigration(
      '20260801140200_harden_gigl_tracking_status_and_tenant_scope.sql'
    );
    const tenantMigration = readMigration(
      '20260801140300_scope_gigl_order_status_to_tenant.sql'
    );

    expect(statusMigration).toContain(
      'v_latest_status_event_at < v_latest_persisted_event_at'
    );
    expect(tenantMigration).toContain('orders.merchant_id = NEW.merchant_id');
  });

  it('restores retryable order status and suppresses obsolete terminal notifications', () => {
    const migration = readMigration(
      '20260801140400_restore_gigl_tracking_safety_guards.sql'
    );

    const orderStatusFunction = migration.slice(
      migration.indexOf(
        'CREATE OR REPLACE FUNCTION private.sync_gigl_tracking_order_status()'
      ),
      migration.indexOf(
        'ALTER FUNCTION private.sync_gigl_tracking_order_status()'
      )
    );
    expect(orderStatusFunction).toContain(
      'AND orders.merchant_id = NEW.merchant_id'
    );
    expect(orderStatusFunction).toContain(
      'AND orders.shipping_status IS DISTINCT FROM v_shipping_status'
    );
    expect(orderStatusFunction).toContain(
      "NEW.status IS DISTINCT FROM 'failed'"
    );
    expect(orderStatusFunction).toContain(
      "orders.shipping_status NOT IN ('shipped', 'delivered')"
    );
    const terminalOverrideStart = migration.indexOf(
      "    IF NEW.provider = 'GIGL'\n       AND NEW.status IN ('delivered', 'cancelled', 'failed', 'returned')"
    );
    const terminalOverride = migration.slice(
      terminalOverrideStart,
      migration.indexOf('    ELSIF NEW.provider =', terminalOverrideStart)
    );
    expect(terminalOverride).toContain(
      "skip_reason = 'tracking_terminal_override'"
    );
    expect(terminalOverride).toContain('WHERE outbox.shipment_id = NEW.id');
    expect(terminalOverride).toContain("outbox.status = 'pending'");
    expect(terminalOverride).toContain(
      "outbox.status = 'processing'\n            AND outbox.delivery_started_at IS NULL"
    );
  });

  it('distinguishes manual failure transitions from worker updates', () => {
    const migration = readMigration(
      '20260801140800_allow_manual_gigl_failure_order_status.sql'
    );
    const sqlRegression = readMigrationTest(
      'gigl_tracking_manual_failure_order_status.sql'
    );
    const orderStatusFunction = migration.slice(
      migration.indexOf(
        'CREATE OR REPLACE FUNCTION private.sync_gigl_tracking_order_status()'
      ),
      migration.indexOf(
        'ALTER FUNCTION private.sync_gigl_tracking_order_status()'
      )
    );

    expect(orderStatusFunction).toContain(
      'NEW.last_tracked_at IS NOT DISTINCT FROM OLD.last_tracked_at'
    );
    expect(orderStatusFunction).toContain(
      "orders.shipping_status NOT IN ('shipped', 'delivered')"
    );
    expect(sqlRegression).toContain(
      "SET status = 'failed', last_tracked_at = now()"
    );
    expect(sqlRegression).toContain(
      "SET status = 'failed'\n  WHERE id = v_shipment_id"
    );
    expect(sqlRegression).toContain(
      'worker-applied failed attempt must preserve shipped order status'
    );
    expect(sqlRegression).toContain(
      'manual failed transition must update order status'
    );
  });

  it('keeps failed notification attempts as ordering barriers', () => {
    const migration = readMigration(
      '20260801140900_preserve_failed_gigl_notification_barriers.sql'
    );
    const sqlRegression = readMigrationTest(
      'gigl_tracking_notification_order.sql'
    );

    expect(
      migration.match(
        /newer\.status IN \('pending', 'processing', 'sent', 'failed'\)/g
      )
    ).toHaveLength(2);
    expect(sqlRegression).toContain(
      "SET status = 'failed',\n    delivery_started_at = now()"
    );
    expect(sqlRegression).toContain(
      'failed newer GIGL notifications must remain ordering barriers'
    );
  });

  it('compares status observations with the persisted status event', () => {
    const migration = readMigration(
      '20260801140500_repair_gigl_tracking_result_status_and_notifications.sql'
    );

    expect(migration).not.toMatch(/^\+CREATE OR REPLACE FUNCTION/m);
    expect(migration).toContain('v_latest_persisted_status_event_at');
    expect(migration).toContain(
      "entry.event->>'normalized_status', entry.event->>'status'"
    );
    expect(migration).toContain(
      'v_latest_status_event_at < v_latest_persisted_status_event_at'
    );
    expect(migration).toContain(
      'v_latest_status_event_at <= v_latest_persisted_status_event_at'
    );
    expect(migration).toContain(
      'AND event.normalized_status = v_effective_status'
    );
    expect(migration).not.toContain(
      "coalesce(v_current_status, 'pending') NOT IN ("
    );
  });

  it('preserves terminal notifications created by tracking updates', () => {
    const migration = readMigration(
      '20260801140600_preserve_gigl_worker_notifications.sql'
    );
    const terminalOverride = migration.slice(
      migration.indexOf("AND NEW.status IN ('delivered'")
    );

    expect(terminalOverride).toContain(
      'NEW.last_tracked_at IS NOT DISTINCT FROM OLD.last_tracked_at'
    );
    expect(terminalOverride).toContain(
      "skip_reason = 'tracking_terminal_override'"
    );
  });

  it('scopes monitor retirement to the shipment tenant', () => {
    const migration = readMigration(
      '20260801140700_scope_gigl_monitor_retirement_to_tenant.sql'
    );

    expect(migration).toContain('v_order_is_owned boolean := false');
    expect(migration).toContain(
      'candidate_order.merchant_id = NEW.merchant_id'
    );
    expect(migration).toContain('IF v_order_is_owned THEN');
  });

  it('rejects unowned monitor order identities before upsert', () => {
    const migration = readMigration(
      '20260801141200_reject_unowned_gigl_monitor_orders.sql'
    );
    const sqlRegression = readMigrationTest(
      'gigl_tracking_monitor_tenant_scope.sql'
    );

    expect(migration).toContain('IF NOT v_order_is_owned THEN');
    expect(migration).toContain("SET state = 'inactive'");
    expect(sqlRegression).toContain(
      'cross-tenant shipment identity changes must not poison or retire monitors'
    );
  });

  it('keys notification attempts by tracking event and preserves manual terminals', () => {
    const identityMigration = readMigration(
      '20260801141000_preserve_gigl_tracking_attempt_identity.sql'
    );
    const resultMigration = readMigration(
      '20260801141100_preserve_manual_gigl_terminal_overrides.sql'
    );
    const notificationRegression = readMigrationTest(
      'gigl_tracking_notification_attempts.sql'
    );
    const terminalRegression = readMigrationTest(
      'gigl_tracking_manual_terminal_override.sql'
    );

    expect(identityMigration).toContain(
      'manual_terminal_override_at timestamptz'
    );
    expect(identityMigration).toContain(
      'tracking_event_id,\n    audience,\n    notification_kind'
    );
    expect(resultMigration).toContain(
      'v_latest_incoming_event_at <= v_manual_terminal_override_at'
    );
    expect(resultMigration).toContain(
      'shipment_id, tracking_epoch_id, tracking_event_id, audience'
    );
    expect(notificationRegression).toContain(
      'distinct GIGL delivery attempts must each enqueue a failed notification'
    );
    expect(terminalRegression).toContain(
      'a carrier event older than a manual terminal override must not replace it'
    );
  });
});
