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

describe('GIGL retry and generation hardening migrations', () => {
  it('preserves failures and allows newer nonterminal recovery observations', () => {
    expect(
      readMigration('20260801141300_allow_gigl_retry_recovery_states.sql')
    ).toContain("WHEN 'failed' THEN 0");
    const followUp = readMigration(
      '20260801141800_harden_gigl_tracking_retry_edges.sql'
    );
    expect(followUp).toContain("WHEN 'failed' THEN 5");
    expect(followUp).toContain(
      "p_status IN (''picked_up'', ''in_transit'', ''out_for_delivery'')"
    );
    expect(readMigrationTest('gigl_tracking_retry_recovery.sql')).toContain(
      'a newer nonterminal GIGL scan must recover a failed shipment'
    );
    expect(
      readMigrationTest('gigl_tracking_failure_transitions.sql')
    ).toContain('a newer GIGL failure must remain visible after transit');
  });

  it('ignores obsolete shipment generations when syncing order status', () => {
    expect(
      readMigration(
        '20260801141400_scope_gigl_order_status_to_latest_generation.sql'
      )
    ).toContain('newer_shipment.tracking_timeline_generation');
    expect(
      readMigrationTest('gigl_tracking_order_status_generation.sql')
    ).toContain(
      'an unowned newer GIGL shipment must not block the victim order'
    );
    expect(
      readMigration('20260801141800_harden_gigl_tracking_retry_edges.sql')
    ).toContain('newer_shipment.merchant_id = NEW.merchant_id');
  });

  it('keeps delivery timestamp coverage isolated from notification ordering', () => {
    expect(readMigrationTest('gigl_tracking_delivery_timestamp.sql')).toContain(
      'a stale GIGL delivery timestamp must not replace the persisted timestamp'
    );
    expect(
      readMigrationTest('gigl_tracking_notification_order.sql')
    ).not.toContain(
      'a stale GIGL delivery timestamp must not replace the persisted timestamp'
    );
    expect(readMigrationTest('gigl_tracking_delivery_timestamp.sql')).toContain(
      'cancelled GIGL shipments must not receive delivery metadata'
    );
    expect(
      readMigration('20260801141800_harden_gigl_tracking_retry_edges.sql')
    ).toContain(
      "v_should_update_delivery := v_effective_status = ''delivered''"
    );
  });

  it('keeps milestone identities one-time while preserving retry attempt identity', () => {
    const identityMigration = readMigration(
      '20260801141500_scope_gigl_notification_identity.sql'
    );

    expect(identityMigration).toContain(
      "notification_kind NOT IN ('failed', 'delivery_attempt_failed')"
    );
    expect(identityMigration).toContain(
      'shipment_tracking_notifications_milestone_identity_key'
    );
    expect(identityMigration).toContain(
      'shipment_tracking_notifications_attempt_identity_key'
    );
    expect(identityMigration).toContain('ON CONFLICT DO NOTHING');
    expect(
      readMigrationTest('gigl_tracking_notification_identity.sql')
    ).toContain('GIGL notification identities keep milestones one-time');
  });

  it('records manual terminal overrides from retryable failures', () => {
    const overrideMigration = readMigration(
      '20260801141600_record_manual_gigl_failure_overrides.sql'
    );

    expect(overrideMigration).toContain("OLD.status = 'failed'");
    expect(overrideMigration).toContain(
      "NEW.status IN ('delivered', 'cancelled', 'returned')"
    );
    expect(
      readMigrationTest('gigl_tracking_manual_failure_override.sql')
    ).toContain(
      'manual terminal transitions from failed preserve override state'
    );
  });

  it('compares retry recovery with the persisted failed event', () => {
    const migration = readMigration(
      '20260801141900_scope_gigl_recovery_to_failed_event.sql'
    );

    expect(migration).toContain('v_latest_persisted_status_event_at');
    expect(
      readMigrationTest('gigl_tracking_failure_transitions.sql')
    ).toContain(
      'a recovery between a failed event and newer unknown scan must replace the failure'
    );
  });

  it('provides a service-only reset for definitively rejected push dispatches', () => {
    const dispatchMigration = readMigration(
      '20260801141700_reset_gigl_notification_dispatch_boundary.sql'
    );

    expect(dispatchMigration).toContain(
      'CREATE OR REPLACE FUNCTION public.reset_shipment_tracking_notification_dispatch('
    );
    expect(dispatchMigration).toContain('delivery_started_at = NULL');
    expect(dispatchMigration).toContain('TO service_role');
  });

  it('removes the reset RPC and hardens manual failure and tenant boundaries', () => {
    const followUp = readMigration(
      '20260801142000_harden_gigl_notification_recovery_edges.sql'
    );

    expect(followUp).toContain(
      'DROP FUNCTION IF EXISTS public.reset_shipment_tracking_notification_dispatch'
    );
    expect(followUp).toContain(
      'NEW.merchant_id IS NOT DISTINCT FROM OLD.merchant_id'
    );
    expect(followUp).toContain('v_manual_terminal_failed');
    expect(
      readMigrationTest('gigl_tracking_manual_failure_order_status.sql')
    ).toContain('manual failed final polls must remain terminal');
    expect(
      readMigrationTest('gigl_tracking_monitor_tenant_scope.sql')
    ).toContain(
      'changing a GIGL shipment merchant must deactivate its monitor'
    );
  });

  it('keeps manual failures terminal when only unknown scans are newer', () => {
    const migration = readMigration(
      '20260801142100_preserve_manual_gigl_failures_after_unknown_scans.sql'
    );

    expect(migration).toContain(
      'v_latest_status_event_at <= v_manual_terminal_override_at'
    );
    expect(migration).toContain(
      'GIGL manual failure terminality must use status events'
    );
  });

  it('cleans unowned monitors created by the initial backfill', () => {
    const migration = readMigration(
      '20260801142200_cleanup_unowned_gigl_monitor_backfill.sql'
    );

    expect(migration).toContain(
      'JOIN public.orders AS order_row ON order_row.id = monitor.order_id'
    );
    expect(migration).toContain(
      'shipment.merchant_id IS DISTINCT FROM order_row.merchant_id'
    );
    expect(migration).toContain("SET state = 'inactive'");
  });
});
