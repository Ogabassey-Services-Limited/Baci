import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveGiglTrackingMigrationPath } from './gigl-tracking-migration-path';

const migrationFiles = {
  monitor: '20260727220000_gigl_tracking_monitor_tables.sql',
  snapshot: '20260727220025_shipment_tracking_snapshot_version.sql',
  realtime: '20260727220050_shipment_tracking_realtime_broadcast.sql',
  compatibilityLedger: '20260727220060_push_token_compatibility_ledger.sql',
  capability: '20260727220075_shipment_update_push_capability.sql',
  accessRevocation: '20260727220080_push_token_access_revocation.sql',
  activation: '20260727220100_gigl_tracking_monitor_activation.sql',
} as const;

function readMigration(filename: string) {
  const path = resolveGiglTrackingMigrationPath(
    `../../../../../supabase/migrations/${filename}`,
    filename
  );
  return readFileSync(path, 'utf8');
}

describe('GIGL tracking monitor migrations', () => {
  it('defines the bounded, RLS-protected monitor, event, and outbox tables', () => {
    const migration = readMigration(migrationFiles.monitor);
    for (const requirement of [
      'CREATE TABLE public.shipment_tracking_monitors',
      'CREATE TABLE public.shipment_tracking_events',
      'CREATE TABLE public.shipment_tracking_notification_outbox',
      'UNIQUE (shipment_id, tracking_epoch_id, provider_event_key)',
      'UNIQUE (shipment_id, tracking_epoch_id, audience, notification_kind)',
      'tracking_epoch_id uuid',
      'tracking_timeline_generation integer NOT NULL',
      'storefront_refresh_requested_at timestamptz',
      'storefront_refresh_lease_until timestamptz',
      'char_length(tracking_number) <= 128',
      'char_length(btrim(tracking_number)) <= 128',
      'char_length(provider_event_key) <= 256',
      'char_length(provider_event_id) <= 128',
      'char_length(raw_status) <= 128',
      'char_length(normalized_status) <= 64',
      'char_length(description) <= 2048',
      'char_length(location) <= 512',
      'GRANT SELECT, INSERT, UPDATE, DELETE',
      'TO service_role',
    ]) {
      expect(migration).toContain(requirement);
    }
    expect(migration).not.toContain('raw_payload');
    expect(migration.match(/ENABLE ROW LEVEL SECURITY/g)).toHaveLength(3);
  });

  it('makes snapshot versions and timeline allocation database-owned', () => {
    const migration = readMigration(migrationFiles.snapshot);
    for (const requirement of [
      'ADD COLUMN IF NOT EXISTS tracking_snapshot_version integer',
      'CHECK (tracking_snapshot_version >= 0)',
      'ADD COLUMN IF NOT EXISTS tracking_timeline_generation integer',
      'CHECK (tracking_timeline_generation >= 0)',
      'CREATE TABLE private.order_tracking_timeline_generations',
      'DISABLE TRIGGER set_shipments_updated_at',
      'ENABLE TRIGGER set_shipments_updated_at',
      'CREATE OR REPLACE FUNCTION private.bump_shipment_tracking_snapshot_version()',
      'CREATE TRIGGER bump_shipment_tracking_snapshot_version',
      'SECURITY DEFINER',
      'REVOKE ALL ON FUNCTION private.bump_shipment_tracking_snapshot_version()',
      'CREATE OR REPLACE FUNCTION private.allocate_shipment_tracking_generation(',
      'WHERE shipment.order_id IS NOT NULL',
      "OR NULLIF(btrim(NEW.tracking_number), '')",
      'ORDER BY candidate.order_id',
      'private.allocate_shipment_tracking_generation(uuid, uuid)',
      'CREATE UNIQUE INDEX shipments_order_tracking_timeline_generation_key',
    ]) {
      expect(migration).toContain(requirement);
    }
    expect(migration).not.toMatch(/DISABLE TRIGGER (?:ALL|USER)/);
    expect(migration).not.toMatch(
      /GRANT[^;]+order_tracking_timeline_generations[^;]+(?:anon|authenticated|service_role)/i
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION[\s\S]+allocate_shipment_tracking_generation[\s\S]+FROM PUBLIC, anon, authenticated, service_role/i
    );
  });

  it('uses private empty-payload Realtime wakeups with restrictive topic guards', () => {
    const migration = readMigration(migrationFiles.realtime);

    for (const requirement of [
      'CREATE OR REPLACE FUNCTION private.broadcast_shipment_tracking_wakeup()',
      "SECURITY DEFINER SET search_path = ''",
      'realtime.send(',
      'GIGL_TRACKING_REALTIME_UNAVAILABLE',
      'relation.relrowsecurity',
      'GIGL_TRACKING_SHIPMENTS_PUBLICATION_CONFLICT',
      "'{}'::jsonb",
      "'shipment_tracking_changed'",
      "'order-tracking:'",
      'AFTER INSERT OR UPDATE OR DELETE ON public.shipments',
      'DROP TRIGGER IF EXISTS broadcast_shipment_tracking_wakeup',
      'CREATE POLICY "authorized users receive shipment tracking wakeups"',
      'CREATE POLICY "shipment tracking topics require order access"',
      'CREATE POLICY "shipment tracking topics reject client sends"',
      'ON realtime.messages',
      'AS PERMISSIVE',
      'FOR SELECT TO authenticated',
      'FOR INSERT TO anon, authenticated',
      "realtime.messages.extension = 'broadcast'",
      "realtime.topic() !~ '^order-tracking:'",
      'customer.merchant_id = tracked_order.merchant_id',
      'customer.deleted_at IS NULL',
      'v_old_order_id IS DISTINCT FROM v_new_order_id',
      'REVOKE ALL ON FUNCTION private.emit_shipment_tracking_wakeup(uuid) FROM PUBLIC, anon, authenticated, service_role',
      'REVOKE ALL ON FUNCTION private.broadcast_shipment_tracking_wakeup() FROM PUBLIC, anon, authenticated, service_role',
    ]) {
      expect(migration).toContain(requirement);
    }
    expect(migration).toMatch(
      /CREATE OR REPLACE FUNCTION private\.emit_shipment_tracking_wakeup\(\s*p_order_id uuid\s*\)/i
    );
    expect(migration.match(/AS RESTRICTIVE/g)).toHaveLength(2);
    expect(
      migration.match(/realtime\.topic\(\) !~ '\^order-tracking:'/g)
    ).toHaveLength(2);
    expect(
      migration.match(
        /\^order-tracking:\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$/g
      )
    ).toHaveLength(2);
    expect(migration).not.toContain('realtime.broadcast_changes');
    expect(migration).not.toContain('realtime.messages.private');
    expect(migration).not.toContain("relation.relkind = 'r'");
    expect(migration).not.toMatch(/ALTER PUBLICATION[\s\S]*public\.shipments/i);

    const receivePolicy =
      migration.match(
        /CREATE POLICY "authorized users receive shipment tracking wakeups"[\s\S]*?;/i
      )?.[0] ?? '';
    const accessGuardPolicy =
      migration.match(
        /CREATE POLICY "shipment tracking topics require order access"[\s\S]*?;/i
      )?.[0] ?? '';
    const clientSendGuardPolicy =
      migration.match(
        /CREATE POLICY "shipment tracking topics reject client sends"[\s\S]*?;/i
      )?.[0] ?? '';
    expect(receivePolicy).toContain('AS PERMISSIVE');
    expect(accessGuardPolicy).toMatch(/topic\(\) !~/);
    expect(clientSendGuardPolicy).toContain('AS RESTRICTIVE');
    expect(clientSendGuardPolicy).not.toContain('AS PERMISSIVE');
    expect(accessGuardPolicy).toContain(
      'customer.merchant_id = tracked_order.merchant_id'
    );
    expect(clientSendGuardPolicy).toContain(
      "realtime.topic() !~ '^order-tracking:'"
    );

    const wakeupFunction =
      migration.match(
        /CREATE OR REPLACE FUNCTION private\.broadcast_shipment_tracking_wakeup\(\)[\s\S]*?\$\$;/i
      )?.[0] ?? '';
    const wakeupEmitter =
      migration.match(
        /CREATE OR REPLACE FUNCTION private\.emit_shipment_tracking_wakeup\(\s*p_order_id uuid\s*\)[\s\S]*?\$\$;/i
      )?.[0] ?? '';
    expect(
      wakeupEmitter.match(
        /realtime\.send\(\s*'\{\}'::jsonb,\s*'shipment_tracking_changed',\s*'order-tracking:'\s*\|\|\s*p_order_id::text,\s*true\s*\)/gi
      )
    ).toHaveLength(1);
    expect(
      wakeupFunction.match(
        /private\.emit_shipment_tracking_wakeup\(v_(?:old|new)_order_id\)/gi
      )
    ).toHaveLength(2);
    expect(wakeupFunction).toMatch(
      /TG_OP = 'UPDATE'[\s\S]*NEW\.order_id IS NOT DISTINCT FROM OLD\.order_id[\s\S]*NEW\.tracking_snapshot_version IS NOT DISTINCT FROM[\s\S]*OLD\.tracking_snapshot_version[\s\S]*RETURN NULL/i
    );
    expect(wakeupFunction.match(/EXCEPTION\s+WHEN OTHERS/gi)).toHaveLength(2);
    expect(
      wakeupFunction.match(/SHIPMENT_TRACKING_BROADCAST_FAILED sqlstate=%/g)
    ).toHaveLength(2);
    expect(wakeupFunction).not.toMatch(/realtime\.send|SQLERRM/i);
    expect(wakeupEmitter).not.toMatch(
      /realtime\.broadcast_changes|row_to_json|to_jsonb|jsonb_build_object/i
    );
  });

  it('adds controlled push-token migration stages and monitor activation backfill', () => {
    const [compatibilityLedger, capability, accessRevocation, activation] = [
      migrationFiles.compatibilityLedger,
      migrationFiles.capability,
      migrationFiles.accessRevocation,
      migrationFiles.activation,
    ].map(readMigration);

    for (const requirement of [
      'CREATE TABLE private.push_token_compatibility_events',
      'ALTER TABLE private.push_token_compatibility_events ENABLE ROW LEVEL SECURITY',
      'REVOKE ALL ON TABLE private.push_token_compatibility_events FROM PUBLIC, anon, authenticated',
      'GRANT USAGE ON SCHEMA private TO service_role',
      'GRANT SELECT ON TABLE private.push_token_compatibility_events TO service_role',
    ])
      expect(compatibilityLedger).toContain(requirement);
    expect(compatibilityLedger).not.toMatch(
      /GRANT\s+(INSERT|UPDATE|DELETE)[^;]*push_token_compatibility_events/i
    );
    expect(compatibilityLedger).not.toMatch(
      /\b(token|token_id|user_id|merchant_id|device_name|ip|payload|request_payload)\s+(text|uuid|inet|jsonb)\b/i
    );
    for (const requirement of [
      'ADD COLUMN IF NOT EXISTS shipment_update_capability integer',
      'p_shipment_update_capability integer DEFAULT NULL',
      'shipment_update_capability = excluded.shipment_update_capability',
      "IF v_app_type = 'admin'",
      'public.has_merchant_access(p_merchant_id)',
      'FROM public.customers AS customer',
      'customer.user_id = v_uid',
      'customer.merchant_id = p_merchant_id',
      'customer.deleted_at IS NULL',
      'REVOKE INSERT, UPDATE, DELETE ON public.push_tokens FROM anon',
      'REVOKE INSERT, DELETE ON public.push_tokens FROM authenticated',
      'GRANT UPDATE (is_active) ON public.push_tokens TO authenticated',
      'DROP POLICY IF EXISTS "Users can insert own push tokens" ON public.push_tokens',
      'DROP POLICY IF EXISTS "Users can update own push tokens" ON public.push_tokens',
      'DROP POLICY IF EXISTS "Users can delete own push tokens" ON public.push_tokens',
      'CREATE OR REPLACE FUNCTION public.deactivate_push_token(',
      'GRANT EXECUTE ON FUNCTION public.deactivate_push_token(text) TO authenticated',
    ])
      expect(capability).toContain(requirement);
    expect(capability).not.toContain(
      'coalesce(excluded.shipment_update_capability'
    );
    for (const requirement of [
      'REVOKE UPDATE ON public.push_tokens FROM authenticated',
      'CREATE POLICY "Users can deactivate own push token legacy"',
      'FOR UPDATE TO authenticated',
      'user_id = auth.uid()',
      'is_active IS TRUE',
      'is_active IS FALSE',
      'CREATE OR REPLACE FUNCTION private.stamp_legacy_push_token_logout()',
      'CREATE TRIGGER audit_legacy_push_token_logout',
      "auth.role() = 'authenticated'",
      'OLD.is_active IS TRUE',
      'NEW.is_active IS FALSE',
      "deactivation_reason = 'LegacyDirectLogout'",
      'deactivated_at = now()',
      'updated_at = now()',
      "'legacy_direct_logout'",
      "'legacy_registration'",
      'p_shipment_update_capability IS NULL',
    ])
      expect(capability).toContain(requirement);
    const legacyPolicy =
      capability.match(
        /CREATE POLICY "Users can deactivate own push token legacy"[\s\S]*?;/i
      )?.[0] ?? '';
    expect(legacyPolicy).toContain(
      'USING (user_id = auth.uid() AND is_active IS TRUE)'
    );
    expect(legacyPolicy).toContain(
      'WITH CHECK (user_id = auth.uid() AND is_active IS FALSE)'
    );
    expect(capability).not.toMatch(
      /GRANT UPDATE \((?:merchant_id|app_type|user_id|build_number|shipment_update_capability|deactivation_reason|deactivated_at|updated_at)/i
    );
    expect(capability).not.toMatch(
      /(?:UPDATE|DELETE)\s+private\.push_token_compatibility_events/i
    );
    for (const requirement of [
      'CREATE OR REPLACE FUNCTION private.deactivate_revoked_staff_push_tokens()',
      'CREATE OR REPLACE FUNCTION private.deactivate_replaced_owner_push_tokens()',
      'CREATE OR REPLACE FUNCTION private.deactivate_revoked_customer_push_tokens()',
      'CREATE TRIGGER deactivate_revoked_staff_push_tokens',
      'CREATE TRIGGER deactivate_replaced_owner_push_tokens',
      'CREATE TRIGGER deactivate_revoked_customer_push_tokens',
      'UPDATE public.push_tokens AS token',
      "deactivation_reason = 'MerchantAccessRevoked'",
      "deactivation_reason = 'CustomerAccessRevoked'",
    ])
      expect(accessRevocation).toContain(requirement);
    for (const requirement of [
      'CREATE OR REPLACE FUNCTION private.activate_gigl_tracking_monitor()',
      'AFTER INSERT OR UPDATE OF tracking_number, status, provider, order_id',
      'INSERT INTO public.shipment_tracking_monitors',
      'WITH ranked_shipments AS',
      'FROM public.shipments AS shipment',
      'shipment.order_id IS NOT NULL',
      'shipment.current_rank = 1',
      'pg_catalog.char_length(btrim(shipment.tracking_number)) <= 128',
      "OLD.status IN ('delivered', 'cancelled', 'failed', 'returned')",
      'pg_advisory_xact_lock',
      'ON CONFLICT (shipment_id) DO NOTHING',
    ])
      expect(activation).toContain(requirement);
  });
});
