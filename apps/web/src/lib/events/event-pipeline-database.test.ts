import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const modulePath = resolve(
  process.cwd(),
  'src/lib/events/event-pipeline-database.ts'
);

const functionNames = [
  'claim_event_deliveries_v1',
  'cleanup_domain_event_pipeline_v1',
  'dead_letter_ingress_event_v1',
  'enqueue_domain_event_v1',
  'finish_event_delivery_v1',
  'get_domain_event_queue_metrics_v1',
  'get_event_pipeline_operations_v1',
  'is_event_ingress_capability_v1',
  'list_event_pipeline_deliveries_v1',
  'list_event_pipeline_ingress_failures_v1',
  'read_domain_events_v1',
  'record_analytics_domain_event_v1',
  'record_event_worker_heartbeat_v1',
  'record_platform_domain_event_v1',
  'replay_event_deliveries_batch_v1',
  'replay_event_delivery_v1',
  'replay_ingress_dead_letter_v1',
  'route_domain_event_v1',
  'select_event_pipeline_replay_ids_v1',
] as const;

describe('event pipeline generated database boundary', () => {
  it('derives Args and Returns for all nineteen public functions', async () => {
    expect(existsSync(modulePath), 'typed database boundary is missing').toBe(
      true
    );
    if (!existsSync(modulePath)) return;

    const source = readFileSync(modulePath, 'utf8');
    expect(source).toContain("Database['public']['Functions']");
    expect(source).toContain("['Args']");
    expect(source).toContain("['Returns']");
    for (const name of functionNames) expect(source).toContain(name);

    const moduleUrl = pathToFileURL(modulePath).href;
    const boundary = await import(/* @vite-ignore */ moduleUrl);
    expect(boundary.EVENT_PIPELINE_FUNCTION_NAMES).toEqual(functionNames);
  });

  it('converts plain JSON values and rejects non-JSON values', async () => {
    const moduleUrl = pathToFileURL(modulePath).href;
    const { toEventPipelineJson } = await import(/* @vite-ignore */ moduleUrl);
    expect(
      toEventPipelineJson({ id: 'evt-1', values: [1, true, null] })
    ).toEqual({ id: 'evt-1', values: [1, true, null] });
    expect(() => toEventPipelineJson(new Date())).toThrow(
      'event_pipeline_non_json_value'
    );
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => toEventPipelineJson(cyclic)).toThrow(
      'event_pipeline_non_json_value'
    );
  });

  it('validates allowed, unauthorized, nested, and wildcard projections', async () => {
    const moduleUrl = pathToFileURL(modulePath).href;
    const { validateEventPipelineSelection } = await import(
      /* @vite-ignore */ moduleUrl
    );
    const findings: string[] = [];
    const columnsForTable = (table: string) =>
      new Set(table === 'orders' ? ['id', 'items'] : ['id', 'name']);

    validateEventPipelineSelection(
      'worker.ts',
      'orders',
      'id,items(id,name)',
      findings,
      columnsForTable
    );
    expect(findings).toEqual([]);

    validateEventPipelineSelection(
      'worker.ts',
      'orders',
      'secret,items(secret),*,items(*)',
      findings,
      columnsForTable
    );
    expect(findings).toEqual([
      'worker.ts: unauthorized orders column secret',
      'worker.ts: unauthorized items column secret',
      'worker.ts: unauthorized orders wildcard projection',
      'worker.ts: unauthorized items wildcard projection',
    ]);
  });
});
