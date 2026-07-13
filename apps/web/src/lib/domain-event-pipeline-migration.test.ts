import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const directory = resolve(process.cwd(), '../../supabase/migrations');
const files = [
  '20260712150001_domain_event_pipeline_tables.sql',
  '20260712150050_eventing_internal_schema.sql',
  '20260712150075_domain_event_idempotency_guard.sql',
  '20260712150100_domain_event_enqueue_rpcs.sql',
  '20260712150101_analytics_domain_event_rpc.sql',
  '20260712150102_domain_event_read_rpc.sql',
  '20260712150105_platform_domain_event_rpc.sql',
  '20260712150106_ingress_replay_audit.sql',
  '20260712150110_domain_event_routing_rpcs.sql',
  '20260712150111_domain_event_metrics_rpc.sql',
  '20260712150115_event_delivery_replay_audit.sql',
  '20260712150120_event_delivery_rpcs.sql',
  '20260712150121_event_delivery_replay_rpc.sql',
  '20260712150122_event_delivery_batch_replay_rpc.sql',
  '20260712150125_event_worker_heartbeats.sql',
  '20260712150126_event_pipeline_admin_rpcs.sql',
  '20260712150130_domain_event_cdc_triggers.sql',
  '20260712150140_event_pipeline_retention_rpc.sql',
  '20260713120000_event_delivery_replay_and_idempotency_fixes.sql',
  '20260713222000_platform_event_legacy_idempotency.sql',
] as const;

const sql = Object.fromEntries(
  files.map((file) => [file, readFileSync(resolve(directory, file), 'utf8')])
);
const allSql = Object.values(sql).join('\n');

describe('durable domain-event migration contract', () => {
  it('keeps every migration within the repository modularity ceiling', () => {
    for (const file of files) {
      expect(sql[file].split('\n').length, file).toBeLessThanOrEqual(300);
    }
  });

  it('uses a logged PGMQ queue behind service-only wrappers', () => {
    expect(allSql).toContain('CREATE EXTENSION IF NOT EXISTS pgmq');
    expect(allSql).toContain("SELECT pgmq.create('domain_events')");
    expect(allSql).not.toContain('create_unlogged');
    expect(allSql).toContain('read_domain_events_v1');
    expect(allSql).toMatch(
      /REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA pgmq[\s\S]*FROM PUBLIC, anon, authenticated, service_role/
    );
  });

  it('commits producer deduplication and queue identity in one RPC', () => {
    const enqueue = sql['20260712150100_domain_event_enqueue_rpcs.sql'];
    const analytics = sql['20260712150101_analytics_domain_event_rpc.sql'];
    expect(enqueue).toContain(
      'ON CONFLICT (producer, idempotency_key) DO NOTHING'
    );
    expect(enqueue).toContain("FROM pgmq.send('domain_events', v_envelope)");
    expect(enqueue).toContain('queue_message_id = v_queue_message_id');
    expect(enqueue).toContain('invalid_domain_event_idempotency_key');
    expect(enqueue).not.toMatch(/http|net\.http/i);
    expect(analytics).toContain('analytics_events_merchant_event_id_type_uidx');
    expect(sql['20260712150075_domain_event_idempotency_guard.sql']).toContain(
      'domain_event_idempotency_conflict'
    );
  });

  it('uses a full unique platform event key for legacy upserts', () => {
    const legacyIdempotency =
      sql['20260713222000_platform_event_legacy_idempotency.sql'];
    expect(legacyIdempotency).toContain(
      'DROP INDEX IF EXISTS public.platform_events_type_event_id_uidx'
    );
    expect(legacyIdempotency).toContain(
      'ON public.platform_events (event_type, event_id)'
    );
    expect(legacyIdempotency).not.toContain('WHERE event_id IS NOT NULL');
  });

  it('locks route identity and archives only in the same routing transaction', () => {
    const routing = sql['20260712150110_domain_event_routing_rpcs.sql'];
    expect(routing).toContain('FOR UPDATE');
    expect(routing).toContain(
      'v_ledger.queue_message_id IS DISTINCT FROM p_queue_message_id'
    );
    expect(routing).toContain(
      "SELECT pgmq.archive('domain_events', p_queue_message_id)"
    );
    expect(routing).toContain(
      'ON CONFLICT (domain_event_id, destination) DO NOTHING'
    );
    expect(routing).toContain('p_active_destinations text[]');
    expect(routing).toContain("THEN 'shadowed'");
  });

  it('uses non-blocking leases and claim-token guarded completion', () => {
    const deliveries = sql['20260712150120_event_delivery_rpcs.sql'];
    expect(deliveries).toContain('FOR UPDATE SKIP LOCKED');
    expect(deliveries).toContain('delivery.claim_token = p_claim_token');
    expect(deliveries).toContain("delivery.status = 'claimed'");
    expect(deliveries).toContain("'delivery_unknown'");
    expect(deliveries).toContain("'skipped'");
    expect(deliveries).toContain("'lease_expired'");
  });

  it('keeps replay payloads immutable and records operator audit rows', () => {
    const replay = sql['20260712150121_event_delivery_replay_rpc.sql'];
    const replayFix =
      sql['20260713120000_event_delivery_replay_and_idempotency_fixes.sql'];
    const batch = sql['20260712150122_event_delivery_batch_replay_rpc.sql'];
    expect(replay).toContain('INSERT INTO public.event_delivery_replays');
    expect(replay).not.toMatch(/SET[\s\S]{0,200}payload\s*=/i);
    expect(replayFix).toContain('attempts = 0');
    expect(replayFix).toContain('TO authenticated, service_role');
    expect(batch).toContain('NOT BETWEEN 1 AND 100');
    expect(batch).toContain('TO authenticated, service_role');
    expect(sql['20260712150106_ingress_replay_audit.sql']).toContain(
      'FOR INSERT TO postgres'
    );
  });

  it('ignores volatile delivery context when resolving duplicate events', () => {
    const idempotencyFix =
      sql['20260713120000_event_delivery_replay_and_idempotency_fixes.sql'];
    expect(idempotencyFix).toContain("- 'delivery_user_data'");
  });

  it('ships CDC disabled and serializes only allowlisted fields', () => {
    const tables = sql['20260712150001_domain_event_pipeline_tables.sql'];
    const triggers = sql['20260712150130_domain_event_cdc_triggers.sql'];
    expect(tables).toContain("('catalog.products', false, true)");
    expect(tables).toContain("('commerce.orders', false, true)");
    expect(tables).toContain("('payments.transactions', false, true)");
    expect(triggers).not.toContain('to_jsonb(NEW)');
    expect(triggers).not.toContain('row_to_json(NEW)');
    expect(triggers).not.toContain('customer_email');
    expect(triggers).not.toContain('gateway_reference');
  });

  it('forces RLS and withholds direct writes from browser roles', () => {
    expect(allSql).toContain('FORCE ROW LEVEL SECURITY');
    expect(allSql).toMatch(
      /REVOKE ALL ON TABLE[\s\S]*FROM PUBLIC, anon, authenticated/
    );
    expect(allSql).not.toContain(
      'GRANT ALL ON TABLE public.domain_event_ledger TO service_role'
    );
  });

  it('uses guarded platform-admin RPCs without granting table access', () => {
    const admin = sql['20260712150126_event_pipeline_admin_rpcs.sql'];
    expect(admin).toContain('eventing.is_event_pipeline_operator_v1()');
    expect(admin).toContain('TO authenticated, service_role');
    expect(admin).not.toMatch(
      /GRANT\s+SELECT\s+ON\s+TABLE[\s\S]*authenticated/i
    );
  });

  it('bounds successful-attempt and PGMQ archive retention work', () => {
    const retention = sql['20260712150140_event_pipeline_retention_rpc.sql'];
    expect(retention).toContain('LIMIT 10000');
    expect(retention).toContain('pgmq.a_domain_events');
    expect(retention).toContain("interval '30 days'");
  });

  it('rejects null heartbeat states and indexes failure ownership', () => {
    expect(sql['20260712150125_event_worker_heartbeats.sql']).toContain(
      'p_status IS NULL OR p_status NOT IN'
    );
    expect(sql['20260712150001_domain_event_pipeline_tables.sql']).toContain(
      'domain_event_failures_domain_event_id_idx'
    );
  });
});
