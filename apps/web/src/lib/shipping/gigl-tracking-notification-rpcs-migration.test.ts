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

describe('GIGL tracking notification policy migration', () => {
  it('makes notification policy database-owned and service-only', () => {
    const migration = readMigration(
      '20260727220150_gigl_tracking_notification_policy.sql'
    );

    for (const requirement of [
      'CREATE TABLE private.gigl_tracking_notification_policy',
      'CHECK (num_nonnulls(raw_status, normalized_status) = 1)',
      "audience IN ('merchant', 'customer')",
      'notification_kind IN (',
      "'pickup_assigned'",
      "'delivery_attempt_failed'",
      "'shipment_exception'",
      'UNIQUE (raw_status, audience, notification_kind)',
      'UNIQUE (normalized_status, audience, notification_kind)',
      'ENABLE ROW LEVEL SECURITY',
      'FORCE ROW LEVEL SECURITY',
      'REVOKE ALL ON TABLE private.gigl_tracking_notification_policy',
      'GRANT SELECT ON TABLE private.gigl_tracking_notification_policy TO service_role',
    ]) {
      expect(migration).toContain(requirement);
    }

    expect(migration).not.toMatch(
      /GRANT\s+(INSERT|UPDATE|DELETE)[^;]*gigl_tracking_notification_policy/i
    );
  });

  it('uses bounded, service-only monitor claims with skip-locked concurrency', () => {
    const migration = readMigration(
      '20260727220200_gigl_tracking_monitor_polling_rpcs.sql'
    );

    for (const requirement of [
      'CREATE OR REPLACE FUNCTION public.claim_due_gigl_tracking_monitors(',
      'CREATE OR REPLACE FUNCTION public.release_gigl_tracking_claim(',
      'FOR UPDATE SKIP LOCKED',
      "state IN ('active', 'final_poll')",
      "interval '15 minutes'",
      'p_limit NOT BETWEEN 1 AND 100',
      'p_worker_id',
      "auth.role() IS DISTINCT FROM 'service_role'",
      "USING ERRCODE = '42501'",
      'REVOKE ALL ON FUNCTION public.claim_due_gigl_tracking_monitors',
      'REVOKE ALL ON FUNCTION public.release_gigl_tracking_claim',
      'GRANT EXECUTE ON FUNCTION public.claim_due_gigl_tracking_monitors',
      'GRANT EXECUTE ON FUNCTION public.release_gigl_tracking_claim',
      'TO service_role',
    ]) {
      expect(migration).toContain(requirement);
    }
    expect(migration).not.toMatch(/GRANT EXECUTE[^;]+(?:anon|authenticated)/i);
  });

  it('applies only a currently leased tracking epoch and derives outbox work from policy', () => {
    const migration = readMigration(
      '20260727220250_gigl_tracking_monitor_result_rpcs.sql'
    );

    for (const requirement of [
      'CREATE OR REPLACE FUNCTION public.apply_gigl_tracking_result(',
      'CREATE OR REPLACE FUNCTION public.record_gigl_tracking_failure(',
      'monitor.tracking_epoch_id = p_tracking_epoch_id',
      'monitor.locked_by = btrim(p_worker_id)',
      'jsonb_to_recordset(p_events)',
      'ON CONFLICT (shipment_id, tracking_epoch_id, provider_event_key) DO NOTHING',
      'private.gigl_tracking_notification_policy',
      'NOT EXISTS (',
      'upper(event.raw_status)',
      "interval '5 minutes'",
      "interval '60 minutes'",
      'REVOKE ALL ON FUNCTION public.apply_gigl_tracking_result',
      'REVOKE ALL ON FUNCTION public.record_gigl_tracking_failure',
      'TO service_role',
    ]) {
      expect(migration).toContain(requirement);
    }
  });

  it('claims and completes tracking notification work without exposing worker RPCs', () => {
    const migration = readMigration(
      '20260727220300_gigl_tracking_notification_rpcs.sql'
    );

    for (const requirement of [
      'CREATE OR REPLACE FUNCTION public.claim_shipment_tracking_notifications(',
      'CREATE OR REPLACE FUNCTION public.begin_shipment_tracking_notification_dispatch(',
      'CREATE OR REPLACE FUNCTION public.complete_shipment_tracking_notification(',
      "outbox.status = 'pending'",
      "outbox.status = 'processing'",
      'FOR UPDATE SKIP LOCKED',
      'attempt_count = outbox.attempt_count + 1',
      "interval '15 minutes'",
      'delivery_started_at = now()',
      "p_outcome IS NULL OR p_outcome NOT IN ('sent', 'skipped', 'failed')",
      'THEN NULL ELSE outbox.delivery_started_at END',
      "THEN now() + interval '5 minutes' ELSE now() END",
      'REVOKE ALL ON FUNCTION public.claim_shipment_tracking_notifications',
      'REVOKE ALL ON FUNCTION public.begin_shipment_tracking_notification_dispatch',
      'REVOKE ALL ON FUNCTION public.complete_shipment_tracking_notification',
      'TO service_role',
    ]) {
      expect(migration).toContain(requirement);
    }
  });

  it('preserves legacy event identities and makes dispatch claims replay-safe', () => {
    const resultHardening = readMigration(
      '20260731150000_harden_gigl_tracking_result_merge.sql'
    );
    const notificationHardening = readMigration(
      '20260731150100_harden_gigl_tracking_notification_dispatch.sql'
    );

    for (const requirement of [
      'jsonb_array_length(p_events) = 0',
      "entry.event->>'providerEventKey'",
      "entry.event->>'providerEventId'",
      "entry.event->>'timestamp'",
      'entry.event::text',
    ]) {
      expect(resultHardening).toContain(requirement);
    }

    for (const requirement of [
      "status = 'processing' AND delivery_started_at IS NULL",
      "outbox.status = 'processing'",
      'AND outbox.delivery_started_at IS NULL',
      "last_error = coalesce(outbox.last_error, 'delivery_outcome_unknown')",
      'SET delivery_started_at = now(), attempt_count = outbox.attempt_count + 1',
      'AND outbox.delivery_started_at IS NULL',
      "THEN 'pending'",
    ]) {
      expect(notificationHardening).toContain(requirement);
    }
    const claimFunction =
      notificationHardening.match(
        /CREATE OR REPLACE FUNCTION public\.claim_shipment_tracking_notifications\([\s\S]*?\$\$;/
      )?.[0] ?? '';
    expect(claimFunction).not.toBe('');
    expect(claimFunction).not.toContain('attempt_count =');
  });

  it('repairs notification eligibility and bounds pre-dispatch retry attempts', () => {
    const followupHardening = readMigration(
      '20260731150200_harden_gigl_tracking_notification_followups.sql'
    );

    for (const requirement of [
      'notification_events_not_before = now()',
      'GET DIAGNOSTICS v_shipment_rows = ROW_COUNT',
      'private.try_parse_gigl_tracking_timestamp',
      'attempt_count = outbox.attempt_count + CASE',
      "WHEN p_outcome = 'skipped'",
      "WHEN p_outcome = 'failed'",
    ]) {
      expect(followupHardening).toContain(requirement);
    }
  });

  it('pauses monitors for provider responses without a recognized lifecycle', () => {
    const migration = readMigration(
      '20260801070000_pause_gigl_tracking_monitor_on_unknown_status.sql'
    );

    for (const requirement of [
      'CREATE OR REPLACE FUNCTION public.pause_gigl_tracking_monitor(',
      "SET state = 'paused'",
      'next_poll_at = NULL',
      'stopped_at = now()',
      'locked_at = NULL',
      'locked_by = NULL',
      "auth.role() IS DISTINCT FROM 'service_role'",
      'REVOKE ALL ON FUNCTION public.pause_gigl_tracking_monitor',
      'GRANT EXECUTE ON FUNCTION public.pause_gigl_tracking_monitor',
      'TO service_role',
    ]) {
      expect(migration).toContain(requirement);
    }
  });

  it('prevents stale GIGL polls from regressing shipment and monitor status', () => {
    const statusHardening = readMigration(
      '20260801110001_prevent_stale_gigl_tracking_status_regressions.sql'
    );

    for (const requirement of [
      'CREATE OR REPLACE FUNCTION private.gigl_tracking_status_rank(',
      'v_current_status text',
      'v_effective_status text',
      "WHEN 'cancelled' THEN 7",
      "v_current_status IN ('delivered', 'cancelled', 'failed', 'returned')",
      'private.gigl_tracking_status_rank(p_status)',
      'SET status = v_effective_status',
      "v_effective_status IN ('delivered', 'cancelled', 'failed', 'returned')",
      'GRANT EXECUTE ON FUNCTION public.apply_gigl_tracking_result(uuid, uuid, text, text, text, timestamptz, jsonb)',
      'TO service_role;',
    ]) {
      expect(statusHardening).toContain(requirement);
    }
  });

  it('bounds unchanged GIGL polls and resumes paused monitors after cooldown', () => {
    const pollingHardening = readMigration(
      '20260801120000_resume_gigl_tracking_monitor_cooldowns.sql'
    );
    const unchangedHardening = readMigration(
      '20260801120100_pause_gigl_tracking_after_unchanged_polls.sql'
    );

    for (const requirement of [
      "state IN ('active', 'final_poll', 'paused')",
      'monitor.next_poll_at <= now()',
    ]) {
      expect(pollingHardening).toContain(requirement);
    }
    for (const requirement of [
      'CREATE OR REPLACE FUNCTION private.pause_gigl_tracking_monitor_after_unchanged_polls()',
      'NEW.unchanged_poll_count >= 96',
      "NEW.state := 'paused'",
      "NEW.next_poll_at := now() + interval '24 hours'",
      'CREATE TRIGGER pause_gigl_tracking_after_unchanged_polls',
    ]) {
      expect(unchangedHardening).toContain(requirement);
    }
  });

  it('keeps retryable delivery attempts pollable and preserves current locations', () => {
    const recovery = readMigration(
      '20260801130001_keep_gigl_tracking_after_delivery_attempt_failures.sql'
    );

    for (const requirement of [
      "WHEN 'failed' THEN 5",
      "v_current_status IN ('delivered', 'cancelled', 'returned')",
      "v_effective_status IN ('delivered', 'cancelled', 'returned')",
      'v_should_update_location boolean',
      'private.try_parse_gigl_tracking_timestamp',
      'current_location = CASE',
    ]) {
      expect(recovery).toContain(requirement);
    }
  });

  it('claims notification work in tracking-event order', () => {
    const ordering = readMigration(
      '20260801130100_order_gigl_tracking_notification_dispatch.sql'
    );

    for (const requirement of [
      'JOIN public.shipment_tracking_events AS event',
      'ORDER BY event.occurred_at ASC NULLS LAST',
      'outbox.created_at ASC',
      'outbox.id ASC',
      'claimed.created_at ASC',
    ]) {
      expect(ordering).toContain(requirement);
    }
  });

  it('keeps the order shipping status aligned with monitored GIGL shipments', () => {
    const migration = readMigration(
      '20260727220350_sync_gigl_tracking_order_status.sql'
    );
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION private.sync_gigl_tracking_order_status()'
    );
    expect(migration).toContain("WHEN 'out_for_delivery' THEN 'shipped'");
    expect(migration).toContain("WHEN 'delivered' THEN 'delivered'");
    expect(migration).toContain('AFTER UPDATE OF status ON public.shipments');
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION private.sync_gigl_tracking_order_status()'
    );
  });
});
