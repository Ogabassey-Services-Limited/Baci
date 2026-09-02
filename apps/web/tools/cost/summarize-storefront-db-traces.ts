import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  MAX_INPUT_BYTES,
  MAX_INPUT_ROWS,
  type StorefrontDbTraceMetrics,
} from './measure-vercel-storefront-cost-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonnegativeInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`DB trace row has an invalid ${field}`);
  }
  return value;
}

function cohortName(value: unknown): string {
  if (value === undefined) return 'unknown';
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(value)) {
    throw new Error('DB trace row has an invalid cohort');
  }
  return value;
}

function roundMetric(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function summarizeStorefrontDbTraces(
  path: string
): Promise<StorefrontDbTraceMetrics> {
  const bytes = await readFile(path);
  if (bytes.byteLength > MAX_INPUT_BYTES) {
    throw new Error(`DB trace exceeds the ${MAX_INPUT_BYTES}-byte bound`);
  }

  const rows = bytes
    .toString('utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (rows.length > MAX_INPUT_ROWS) {
    throw new Error(`DB trace exceeds the ${MAX_INPUT_ROWS}-row bound`);
  }

  let dbCalls = 0;
  let dbTimeouts = 0;
  const byCohort: Record<
    string,
    { dbCalls: number; dbTimeouts: number; rows: number }
  > = {};
  for (const line of rows) {
    let candidate: unknown;
    try {
      candidate = JSON.parse(line);
    } catch {
      throw new Error('DB trace contains invalid JSON');
    }
    if (!isRecord(candidate)) throw new Error('DB trace row is not an object');

    const rowCalls = nonnegativeInteger(candidate.dbCalls, 'dbCalls');
    const rowTimeouts = nonnegativeInteger(
      candidate.dbTimeouts ?? 0,
      'dbTimeouts'
    );
    if (rowTimeouts > rowCalls) {
      throw new Error('DB trace row has more timeouts than calls');
    }
    const cohort = cohortName(candidate.cohort);
    let aggregate = byCohort[cohort];
    if (!aggregate) {
      aggregate = { dbCalls: 0, dbTimeouts: 0, rows: 0 };
      byCohort[cohort] = aggregate;
    }
    aggregate.dbCalls += rowCalls;
    aggregate.dbTimeouts += rowTimeouts;
    aggregate.rows += 1;
    dbCalls += rowCalls;
    dbTimeouts += rowTimeouts;
  }

  const withRates = Object.fromEntries(
    Object.entries(byCohort)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([cohort, aggregate]) => [
        cohort,
        {
          ...aggregate,
          dbCallsPerRequest: roundMetric(aggregate.dbCalls / aggregate.rows),
          dbTimeoutRate:
            aggregate.dbCalls === 0
              ? null
              : roundMetric(aggregate.dbTimeouts / aggregate.dbCalls),
        },
      ])
  );

  return {
    byCohort: withRates,
    dbCalls,
    dbCallsPerRequest:
      rows.length === 0 ? null : roundMetric(dbCalls / rows.length),
    dbTimeoutRate: dbCalls === 0 ? null : roundMetric(dbTimeouts / dbCalls),
    dbTimeouts,
    rows: rows.length,
    sourceSha256: sha256(bytes),
  };
}
