import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  type CacheProbeMetrics,
  type CostWindowMeasurement,
  MAX_INPUT_BYTES,
  MAX_INPUT_ROWS,
  type MetricName,
  SERVICE_METRICS,
  type StorefrontCostMeasurement,
  type WindowOptions,
} from './measure-vercel-storefront-cost-types';
import { summarizeStorefrontDbTraces } from './summarize-storefront-db-traces';

const PROJECT_TAG = 'ProjectId';
const CACHE_HIT_STATUSES = new Set(['HIT', 'PRERENDER', 'STALE']);
type FocusRow = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sha256(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

function finiteNonnegative(value: unknown, field: string) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > Number.MAX_SAFE_INTEGER
  )
    throw new Error(`billing row has an invalid ${field}`);
  return value;
}

function dateString(value: unknown, field: string) {
  if (typeof value !== 'string')
    throw new Error(`billing row has an invalid ${field}`);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp))
    throw new Error(`billing row has an invalid ${field}`);
  return new Date(timestamp).toISOString();
}

function roundMetric(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function emptyServices(): Record<MetricName, number> {
  return Object.fromEntries(
    Object.values(SERVICE_METRICS).map((metric) => [metric, 0])
  ) as Record<MetricName, number>;
}

function readProjectId(row: FocusRow) {
  if (!isRecord(row.Tags)) return undefined;
  const value = row.Tags[PROJECT_TAG];
  return typeof value === 'string' ? value : undefined;
}

function percentile(values: readonly number[], fraction: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

async function readBoundedJsonl(path: string, label: string) {
  const bytes = await readFile(path);
  if (bytes.byteLength > MAX_INPUT_BYTES)
    throw new Error(`${label} exceeds the ${MAX_INPUT_BYTES}-byte bound`);
  const lines = bytes.toString('utf8').split(/\r?\n/);
  const rows: unknown[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    if (rows.length >= MAX_INPUT_ROWS)
      throw new Error(`${label} exceeds the ${MAX_INPUT_ROWS}-row bound`);
    try {
      rows.push(JSON.parse(line));
    } catch {
      throw new Error(`${label} contains invalid JSON`);
    }
  }
  return { bytes, rows };
}

async function summarizeCacheProbe(path: string): Promise<CacheProbeMetrics> {
  const { bytes, rows } = await readBoundedJsonl(path, 'cache probe');
  let cacheStatusRows = 0;
  let cacheHitRows = 0;
  const ttfbValues: number[] = [];
  for (const candidate of rows) {
    if (!isRecord(candidate))
      throw new Error('cache probe row is not an object');
    if (typeof candidate.cacheStatus === 'string') {
      cacheStatusRows += 1;
      if (CACHE_HIT_STATUSES.has(candidate.cacheStatus.trim().toUpperCase())) {
        cacheHitRows += 1;
      }
    }
    if (candidate.ttfbMs !== null && candidate.ttfbMs !== undefined)
      ttfbValues.push(finiteNonnegative(candidate.ttfbMs, 'ttfbMs'));
  }
  return {
    cacheStatusRows,
    cacheHitRows,
    cacheHitRatio:
      cacheStatusRows === 0 ? null : cacheHitRows / cacheStatusRows,
    p50TtfbMs: percentile(ttfbValues, 0.5),
    p95TtfbMs: percentile(ttfbValues, 0.95),
    rows: rows.length,
    sourceSha256: sha256(bytes),
  };
}

async function summarizeBillingWindow(
  path: string,
  projectId: string,
  options: WindowOptions
): Promise<CostWindowMeasurement> {
  if (!projectId.trim()) throw new Error('projectId is required');
  if (!/^[a-f0-9]{40}$/i.test(options.deploymentSha))
    throw new Error('deploymentSha must be a 40-character Git SHA');
  const { bytes, rows } = await readBoundedJsonl(path, 'billing export');
  const services = emptyServices();
  let projectEffectiveCostUsd = 0;
  let ignoredRows = 0;
  let observedStart = '';
  let observedEnd = '';
  for (const candidate of rows) {
    if (!isRecord(candidate)) throw new Error('billing row is not an object');
    const row = candidate;
    const start = dateString(row.ChargePeriodStart, 'ChargePeriodStart');
    const end = dateString(row.ChargePeriodEnd, 'ChargePeriodEnd');
    if (Date.parse(end) <= Date.parse(start))
      throw new Error('billing row has a non-positive charge period');
    const effectiveCost = finiteNonnegative(row.EffectiveCost, 'EffectiveCost');
    const quantity = finiteNonnegative(
      row.ConsumedQuantity,
      'ConsumedQuantity'
    );
    if (readProjectId(row) !== projectId) {
      ignoredRows += 1;
      continue;
    }
    projectEffectiveCostUsd += effectiveCost;
    observedStart =
      !observedStart || start < observedStart ? start : observedStart;
    observedEnd = !observedEnd || end > observedEnd ? end : observedEnd;
    const metric =
      SERVICE_METRICS[row.ServiceName as keyof typeof SERVICE_METRICS];
    if (metric) services[metric] += quantity;
  }
  if (!observedStart || !observedEnd)
    throw new Error(`billing export has no rows for project ${projectId}`);
  const hasRequestedWindowStart = Boolean(options.requestedWindowStart);
  const hasRequestedWindowEnd = Boolean(options.requestedWindowEnd);
  if (hasRequestedWindowStart !== hasRequestedWindowEnd) {
    throw new Error('requested billing window requires both start and end');
  }
  const requestedWindow =
    hasRequestedWindowStart && hasRequestedWindowEnd
      ? {
          start: dateString(
            options.requestedWindowStart,
            'requestedWindowStart'
          ),
          end: dateString(options.requestedWindowEnd, 'requestedWindowEnd'),
        }
      : undefined;
  if (
    requestedWindow &&
    Date.parse(requestedWindow.end) <= Date.parse(requestedWindow.start)
  )
    throw new Error('requested billing window must be positive');
  const cacheProbe = options.cacheProbePath
    ? await summarizeCacheProbe(options.cacheProbePath)
    : undefined;
  const dbTrace = options.dbTracePath
    ? await summarizeStorefrontDbTraces(options.dbTracePath)
    : undefined;
  return {
    ...(cacheProbe ? { cacheProbe } : {}),
    ...(dbTrace ? { dbTrace } : {}),
    deploymentSha: options.deploymentSha.toLowerCase(),
    ignoredRows,
    label: options.label,
    projectId,
    sourceSha256: sha256(bytes),
    totalRows: rows.length,
    observedChargePeriod: { end: observedEnd, start: observedStart },
    ...(requestedWindow ? { requestedWindow } : {}),
    metrics: {
      projectEffectiveCostUsd: roundMetric(projectEffectiveCostUsd),
      services: Object.fromEntries(
        Object.entries(services).map(([metric, value]) => [
          metric,
          roundMetric(value),
        ])
      ) as Record<MetricName, number>,
    },
  };
}

function compareWindows(
  before: CostWindowMeasurement,
  after: CostWindowMeasurement | null
) {
  if (!after) return null;
  const values: Record<string, number> = {
    projectEffectiveCostUsd: before.metrics.projectEffectiveCostUsd,
    ...before.metrics.services,
  };
  const afterValues: Record<string, number> = {
    projectEffectiveCostUsd: after.metrics.projectEffectiveCostUsd,
    ...after.metrics.services,
  };
  if (before.dbTrace && after.dbTrace) {
    values.dbCalls = before.dbTrace.dbCalls;
    afterValues.dbCalls = after.dbTrace.dbCalls;
    values.dbTimeouts = before.dbTrace.dbTimeouts;
    afterValues.dbTimeouts = after.dbTrace.dbTimeouts;
    if (
      before.dbTrace.dbCallsPerRequest !== null &&
      after.dbTrace.dbCallsPerRequest !== null
    ) {
      values.dbCallsPerRequest = before.dbTrace.dbCallsPerRequest;
      afterValues.dbCallsPerRequest = after.dbTrace.dbCallsPerRequest;
    }
  }
  if (before.cacheProbe && after.cacheProbe) {
    values.cacheStatusRows = before.cacheProbe.cacheStatusRows;
    afterValues.cacheStatusRows = after.cacheProbe.cacheStatusRows;
    values.cacheHitRows = before.cacheProbe.cacheHitRows;
    afterValues.cacheHitRows = after.cacheProbe.cacheHitRows;
    if (
      before.cacheProbe.cacheHitRatio !== null &&
      after.cacheProbe.cacheHitRatio !== null
    ) {
      values.cacheHitRatio = before.cacheProbe.cacheHitRatio;
      afterValues.cacheHitRatio = after.cacheProbe.cacheHitRatio;
    }
  }
  return Object.fromEntries(
    Object.keys(values).map((metric) => {
      const beforeValue = values[metric];
      const afterValue = afterValues[metric];
      return [
        metric,
        {
          absoluteDelta: roundMetric(afterValue - beforeValue),
          after: afterValue,
          before: beforeValue,
          relativeChangePct:
            beforeValue === 0
              ? null
              : roundMetric(((afterValue - beforeValue) / beforeValue) * 100),
        },
      ];
    })
  );
}

export async function measureVercelStorefrontCost(options: {
  after?: { inputPath: string; window: WindowOptions };
  before: { inputPath: string; window: WindowOptions };
  projectId: string;
}): Promise<StorefrontCostMeasurement> {
  const before = await summarizeBillingWindow(
    options.before.inputPath,
    options.projectId,
    options.before.window
  );
  const after = options.after
    ? await summarizeBillingWindow(
        options.after.inputPath,
        options.projectId,
        options.after.window
      )
    : null;
  const hasDbTracePair = Boolean(before.dbTrace && after?.dbTrace);
  return {
    after,
    before,
    comparisonStatus: after
      ? hasDbTracePair
        ? 'complete'
        : 'incomplete'
      : 'not_available',
    comparison: compareWindows(before, after),
    limitations: [
      'FOCUS billing rows are project-level; they cannot attribute CPU, memory, or invocations to PDP, compare, or blog routes.',
      'The requested window is recorded as provenance; supply exports already filtered to that UTC window because billing rows are not split by route or request.',
      ...(hasDbTracePair
        ? []
        : [
            'Comparison is incomplete without both before and after DB traces; Vercel billing exports do not contain database-call counts. Provide bounded DB trace JSONL inputs or collect the same fields from Supabase telemetry.',
          ]),
      'Cache hit ratio requires the optional sampled cache-probe JSONL; it is not a billing-export field and is not a census.',
      ...(after
        ? []
        : [
            'No after window was supplied, so no before/after savings claim is produced.',
          ]),
    ],
    projectId: options.projectId,
    schemaVersion: 1,
  };
}
