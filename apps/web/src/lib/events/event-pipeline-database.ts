import type { Database, Json } from '@/types/supabase';

export function toEventPipelineJson(
  value: unknown,
  ancestors = new WeakSet<object>()
): Json {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw new Error('event_pipeline_non_json_value');
    ancestors.add(value);
    try {
      return value.map((item) => toEventPipelineJson(item, ancestors));
    } finally {
      ancestors.delete(value);
    }
  }
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
      throw new Error('event_pipeline_non_json_value');
    if (ancestors.has(value)) throw new Error('event_pipeline_non_json_value');
    ancestors.add(value);
    try {
      return Object.fromEntries(
        Object.entries(value).flatMap(([key, item]) =>
          item === undefined
            ? []
            : [[key, toEventPipelineJson(item, ancestors)]]
        )
      );
    } finally {
      ancestors.delete(value);
    }
  }
  throw new Error('event_pipeline_non_json_value');
}

export function validateEventPipelineSelection(
  path: string,
  table: string,
  selection: string,
  findings: string[],
  columnsForTable: (name: string) => ReadonlySet<string>
) {
  let depth = 0;
  let start = 0;
  const segments: string[] = [];
  for (let index = 0; index <= selection.length; index += 1) {
    const character = selection[index];
    if (character === '(') depth += 1;
    else if (character === ')') depth -= 1;
    else if ((character === ',' || character === undefined) && depth === 0) {
      segments.push(selection.slice(start, index).trim());
      start = index + 1;
    }
  }
  const allowedColumns = columnsForTable(table);
  for (const segment of segments) {
    if (segment === '*') {
      findings.push(`${path}: unauthorized ${table} wildcard projection`);
      continue;
    }
    const relation = segment.match(
      /^(?:[A-Za-z_][\w$]*:)?([A-Za-z_][\w$]*)\((.*)\)$/s
    );
    if (relation) {
      validateEventPipelineSelection(
        path,
        relation[1] ?? '',
        relation[2] ?? '',
        findings,
        columnsForTable
      );
      continue;
    }
    const name = segment.match(/^[A-Za-z_][\w$]*/)?.[0];
    if (name && !allowedColumns.has(name))
      findings.push(`${path}: unauthorized ${table} column ${name}`);
  }
}

export const EVENT_PIPELINE_FUNCTION_NAMES = [
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
] as const satisfies readonly (keyof Database['public']['Functions'])[];

export const EVENT_PIPELINE_ALLOWED_CALLERS: Readonly<
  Record<string, readonly string[]>
> = {
  claim_event_deliveries_v1: [
    'apps/web/src/scripts/process-event-deliveries.ts',
  ],
  cleanup_domain_event_pipeline_v1: [
    'vps-workers/jobs/supabase-retention-cleanup.mjs',
  ],
  dead_letter_ingress_event_v1: [
    'apps/web/src/scripts/process-domain-events.ts',
  ],
  enqueue_domain_event_v1: [
    'apps/web/src/lib/events/enqueue-paid-order-domain-event.ts',
  ],
  finish_event_delivery_v1: [
    'apps/web/src/scripts/process-event-deliveries.ts',
  ],
  get_event_pipeline_operations_v1: [
    'apps/web/src/app/api/admin/event-pipeline/dead-letters/route.ts',
  ],
  list_event_pipeline_deliveries_v1: [
    'apps/web/src/app/api/admin/event-pipeline/dead-letters/route.ts',
  ],
  list_event_pipeline_ingress_failures_v1: [
    'apps/web/src/app/api/admin/event-pipeline/dead-letters/route.ts',
  ],
  read_domain_events_v1: ['apps/web/src/scripts/process-domain-events.ts'],
  record_analytics_domain_event_v1: [
    'apps/web/src/lib/events/record-analytics-domain-event.ts',
  ],
  record_event_worker_heartbeat_v1: [
    'apps/web/src/scripts/process-domain-events.ts',
    'apps/web/src/scripts/process-event-deliveries.ts',
  ],
  record_platform_domain_event_v1: [
    'apps/web/src/lib/events/record-platform-domain-event.ts',
  ],
  replay_event_deliveries_batch_v1: [
    'apps/web/src/app/api/admin/event-pipeline/replay/route.ts',
  ],
  replay_ingress_dead_letter_v1: [
    'apps/web/src/app/api/admin/event-pipeline/replay/route.ts',
  ],
  route_domain_event_v1: ['apps/web/src/scripts/process-domain-events.ts'],
  select_event_pipeline_replay_ids_v1: [
    'apps/web/src/app/api/admin/event-pipeline/replay/route.ts',
  ],
};

export type EventPipelineFunctionName =
  (typeof EVENT_PIPELINE_FUNCTION_NAMES)[number];

export type EventPipelineFunctionArgs<Name extends EventPipelineFunctionName> =
  Database['public']['Functions'][Name]['Args'];

export type EventPipelineFunctionReturns<
  Name extends EventPipelineFunctionName,
> = Database['public']['Functions'][Name]['Returns'];

// Compile-only bridge for the JavaScript VPS cleanup wrapper and both typed
// TypeScript worker entrypoints. These are generated contracts, not replicas.
type CleanupArgs =
  EventPipelineFunctionArgs<'cleanup_domain_event_pipeline_v1'>;
type CleanupReturns =
  EventPipelineFunctionReturns<'cleanup_domain_event_pipeline_v1'>;
type RoutingReadArgs = EventPipelineFunctionArgs<'read_domain_events_v1'>;
type DeliveryClaimReturns =
  EventPipelineFunctionReturns<'claim_event_deliveries_v1'>;

export type EventPipelineWorkerContracts = {
  cleanup: { args: CleanupArgs; returns: CleanupReturns };
  deliveryClaim: DeliveryClaimReturns;
  routingRead: RoutingReadArgs;
};
