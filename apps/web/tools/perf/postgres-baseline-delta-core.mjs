import { createHash } from 'node:crypto';
import { buildOperationalDeltas } from './postgres-baseline-delta-operational.mjs';
import { buildRelationDeltas } from './postgres-baseline-delta-relations.mjs';
import { validateIntervalSafety } from './postgres-baseline-delta-safety.mjs';
import { buildStatementDeltas } from './postgres-baseline-delta-statements.mjs';
import { createFingerprint } from './postgres-baseline-fingerprint.mjs';

const DATABASE_COUNTERS = [
  'xact_commit',
  'xact_rollback',
  'blks_read',
  'blks_hit',
  'tup_returned',
  'tup_fetched',
  'tup_inserted',
  'tup_updated',
  'tup_deleted',
  'conflicts',
  'temp_files',
  'temp_bytes',
  'deadlocks',
  'blk_read_time',
  'blk_write_time',
  'sessions',
  'sessions_abandoned',
  'sessions_fatal',
  'sessions_killed',
];
const DECIMAL_DATABASE_COUNTERS = new Set(['blk_read_time', 'blk_write_time']);
const WAL_COUNTERS = [
  'wal_records',
  'wal_fpi',
  'wal_bytes',
  'wal_buffers_full',
];
const INTEGER_STRING = /^\d+$/;
const DECIMAL_STRING = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
function parseSnapshot(raw, label) {
  let parsed;
  try {
    parsed = JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : raw);
  } catch (error) {
    throw new Error(`${label} snapshot is not valid JSON`, { cause: error });
  }
  if (Array.isArray(parsed)) {
    if (parsed.length !== 1 || !parsed[0]?.snapshot) {
      throw new Error(
        `${label} SQL export must contain exactly one snapshot row`
      );
    }
    parsed = parsed[0].snapshot;
  } else if (parsed?.snapshot) {
    parsed = parsed.snapshot;
  }
  if (parsed?.schema_version === 1) {
    throw new Error(
      `${label} snapshot schema_version 1 lacks cron execution targets; recapture both snapshots with schema_version 3`
    );
  }
  if (parsed?.schema_version === 2) {
    throw new Error(
      `${label} snapshot schema_version 2 lacks cron runtime settings; recapture both snapshots with schema_version 3`
    );
  }
  if (parsed?.schema_version !== 3) {
    throw new Error(`${label} snapshot schema_version must be 3`);
  }
  return parsed;
}
function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
function timestamp(value, label) {
  const milliseconds = Date.parse(value);
  if (typeof value !== 'string' || !Number.isFinite(milliseconds)) {
    throw new Error(`${label} must be an ISO timestamp`);
  }
  return milliseconds;
}
function decimal(value, label) {
  if (typeof value !== 'string' || !DECIMAL_STRING.test(value)) {
    throw new Error(`${label} must be a non-negative number`);
  }
  const parsed = Number(value);
  if (
    !Number.isFinite(parsed) ||
    parsed < 0 ||
    (Number.isInteger(parsed) && !Number.isSafeInteger(parsed))
  ) {
    throw new Error(`${label} must be a non-negative number`);
  }
  return parsed;
}
function integer(value, label) {
  if (typeof value !== 'string' || !INTEGER_STRING.test(value)) {
    throw new Error(`${label} must be an integer string`);
  }
  return BigInt(value);
}
function counterDelta(before, after, label, isDecimal = false) {
  if (isDecimal) {
    const delta = decimal(after, label) - decimal(before, label);
    if (delta < -Number.EPSILON) throw new Error(`${label} regressed`);
    return Number(Math.max(0, delta).toFixed(6));
  }
  const left = integer(before, label);
  const right = integer(after, label);
  if (right < left) throw new Error(`${label} regressed`);
  return (right - left).toString();
}
function deltaSet(before, after, counters, decimalCounters, prefix) {
  return Object.fromEntries(
    counters.map((counter) => {
      if (before?.[counter] == null || after?.[counter] == null) {
        throw new Error(`${prefix}.${counter} is missing`);
      }
      return [
        counter,
        counterDelta(
          before[counter],
          after[counter],
          `${prefix}.${counter}`,
          decimalCounters.has(counter)
        ),
      ];
    })
  );
}
function greatestCommonDivisor(left, right) {
  let currentLeft = left;
  let currentRight = right;
  while (currentRight !== 0n) {
    [currentLeft, currentRight] = [currentRight, currentLeft % currentRight];
  }
  return currentLeft;
}
function exactDailyRates(delta, durationMilliseconds, excludedCounters) {
  const denominator = BigInt(durationMilliseconds);
  return Object.fromEntries(
    Object.entries(delta)
      .filter(([key]) => !excludedCounters.has(key))
      .map(([key, value]) => {
        const numerator = BigInt(value) * 86_400_000n;
        const divisor = greatestCommonDivisor(numerator, denominator);
        const reducedNumerator = numerator / divisor;
        const reducedDenominator = denominator / divisor;
        return [
          key,
          reducedDenominator === 1n
            ? reducedNumerator.toString()
            : `${reducedNumerator}/${reducedDenominator}`,
        ];
      })
  );
}
function approximateDailyTimingRates(delta, durationMilliseconds) {
  return Object.fromEntries(
    [...DECIMAL_DATABASE_COUNTERS].map((key) => [
      key,
      Number(
        ((Number(delta[key]) * 86_400_000) / durationMilliseconds).toFixed(6)
      ),
    ])
  );
}
export function createPostgresBaselineDelta({
  afterArtifact,
  afterRaw,
  beforeArtifact,
  beforeRaw,
  deployedSha,
  fingerprintKey,
}) {
  if (!/^[a-f0-9]{40}$/i.test(deployedSha ?? '')) {
    throw new Error('deployedSha must be a 40-character Git commit SHA');
  }
  if (
    !Buffer.isBuffer(beforeArtifact) ||
    beforeArtifact.byteLength === 0 ||
    !Buffer.isBuffer(afterArtifact) ||
    afterArtifact.byteLength === 0
  ) {
    throw new Error('a non-empty encrypted artifact pair is required');
  }
  if (beforeArtifact.equals(afterArtifact))
    throw new Error('encrypted artifacts must be distinct');
  const fingerprint = createFingerprint(fingerprintKey);
  const before = parseSnapshot(beforeRaw, 'before');
  const after = parseSnapshot(afterRaw, 'after');
  const start = timestamp(before.captured_at, 'before.captured_at');
  const end = timestamp(after.captured_at, 'after.captured_at');
  if (end <= start)
    throw new Error('after snapshot must be later than before snapshot');
  const durationMilliseconds = end - start;
  const resetSafety = validateIntervalSafety(before, after);
  const databaseDelta = deltaSet(
    before.database,
    after.database,
    DATABASE_COUNTERS,
    DECIMAL_DATABASE_COUNTERS,
    'database'
  );
  const walDelta = deltaSet(
    before.wal,
    after.wal,
    WAL_COUNTERS,
    new Set(),
    'wal'
  );
  return {
    schema_version: 1,
    deployed_sha: deployedSha.toLowerCase(),
    interval: {
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      duration_seconds: durationMilliseconds / 1000,
    },
    reset_safety: {
      accepted: true,
      ...resetSafety,
    },
    raw_exports: {
      before: {
        sha256: sha256(beforeArtifact),
        source: 'encrypted_artifact',
      },
      after: { sha256: sha256(afterArtifact), source: 'encrypted_artifact' },
    },
    database_aggregates: {
      delta: databaseDelta,
      per_day_exact: exactDailyRates(
        databaseDelta,
        durationMilliseconds,
        DECIMAL_DATABASE_COUNTERS
      ),
      per_day_timing_ms_approximate: approximateDailyTimingRates(
        databaseDelta,
        durationMilliseconds
      ),
    },
    wal_aggregates: {
      delta: walDelta,
      per_day_exact: exactDailyRates(walDelta, durationMilliseconds, new Set()),
    },
    statement_deltas: buildStatementDeltas(before, after, fingerprint),
    relation_deltas: buildRelationDeltas(before, after, fingerprint),
    operational_deltas: buildOperationalDeltas(before, after, fingerprint),
    client_telemetry: {
      included: false,
      required_for: ['p50', 'p95', 'p99', 'errors', 'timeouts', 'throughput'],
    },
  };
}
