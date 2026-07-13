import { createHash } from 'node:crypto';

const IO_COUNTERS = [
  'reads',
  'writes',
  'writebacks',
  'extends',
  'hits',
  'evictions',
  'reuses',
  'fsyncs',
];
const IO_TIMINGS = [
  'read_time',
  'write_time',
  'writeback_time',
  'extend_time',
  'fsync_time',
];

function fingerprint(value) {
  return createHash('sha256').update(value).digest('hex');
}

function requiredString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function integer(value, label) {
  try {
    const parsed = BigInt(value);
    if (parsed < 0n) throw new Error('negative');
    return parsed;
  } catch (error) {
    throw new Error(`${label} must be a non-negative integer string`, {
      cause: error,
    });
  }
}

function decimal(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
  return parsed;
}

function rows(snapshot, field, label) {
  if (!Array.isArray(snapshot?.[field])) {
    throw new Error(`${label}.${field} must be an array`);
  }
  return snapshot[field];
}

function keyedRows(snapshot, field, label, identity) {
  const mapped = new Map();
  rows(snapshot, field, label).forEach((row, index) => {
    const rowLabel = `${label}.${field}[${index}]`;
    const key = identity(row, rowLabel);
    if (mapped.has(key)) throw new Error(`duplicate ${field} identity`);
    mapped.set(key, { row, rowLabel });
  });
  return mapped;
}

function ioIdentity(row, label) {
  return [
    requiredString(row?.backend_type, `${label}.backend_type`),
    requiredString(row?.object, `${label}.object`),
    requiredString(row?.context, `${label}.context`),
  ].join('\u001f');
}

function connectionIdentity(row, label) {
  return [
    requiredString(row?.backend_type, `${label}.backend_type`),
    requiredString(row?.state, `${label}.state`),
    requiredString(row?.application_name, `${label}.application_name`),
  ].join('\u001f');
}

function lockIdentity(row, label) {
  if (typeof row?.granted !== 'boolean') {
    throw new Error(`${label}.granted must be a boolean`);
  }
  return [
    requiredString(row?.locktype, `${label}.locktype`),
    requiredString(row?.mode, `${label}.mode`),
    String(row.granted),
  ].join('\u001f');
}

function stablePairs(beforeRows, afterRows, label) {
  for (const key of beforeRows.keys()) {
    if (!afterRows.has(key)) throw new Error(`${label} row disappeared`);
  }
  for (const key of afterRows.keys()) {
    if (!beforeRows.has(key)) throw new Error(`${label} row appeared`);
  }
  return [...beforeRows.keys()].sort().map((key) => ({
    key,
    before: beforeRows.get(key),
    after: afterRows.get(key),
  }));
}

function exactCounterDeltas(before, after, fields, beforeLabel, afterLabel) {
  return Object.fromEntries(
    fields.map((field) => {
      const left = integer(before[field], `${beforeLabel}.${field}`);
      const right = integer(after[field], `${afterLabel}.${field}`);
      if (right < left) throw new Error(`${afterLabel}.${field} regressed`);
      return [field, (right - left).toString()];
    })
  );
}

function stableInteger(before, after, field, beforeLabel, afterLabel) {
  const left = integer(before[field], `${beforeLabel}.${field}`);
  const right = integer(after[field], `${afterLabel}.${field}`);
  if (left !== right) throw new Error(`${afterLabel}.${field} changed`);
  return left.toString();
}

function timingDeltas(before, after, beforeLabel, afterLabel) {
  return Object.fromEntries(
    IO_TIMINGS.map((field) => {
      const left = decimal(before[field], `${beforeLabel}.${field}`);
      const right = decimal(after[field], `${afterLabel}.${field}`);
      if (right < left) throw new Error(`${afterLabel}.${field} regressed`);
      return [field, Number((right - left).toFixed(6))];
    })
  );
}

function gauge(before, after, field, beforeLabel, afterLabel) {
  const left = integer(before[field], `${beforeLabel}.${field}`);
  const right = integer(after[field], `${afterLabel}.${field}`);
  return {
    before: left.toString(),
    after: right.toString(),
    delta: (right - left).toString(),
  };
}

function rollingGauge(before, after, field, beforeLabel, afterLabel) {
  return {
    before: integer(before[field], `${beforeLabel}.${field}`).toString(),
    after: integer(after[field], `${afterLabel}.${field}`).toString(),
  };
}

function gaugeRows(before, after, field, label, identity) {
  const beforeRows = keyedRows(before, field, 'before', identity);
  const afterRows = keyedRows(after, field, 'after', identity);
  const keys = new Set([...beforeRows.keys(), ...afterRows.keys()]);
  return [...keys].sort().map((key) => {
    const beforeEntry = beforeRows.get(key);
    const afterEntry = afterRows.get(key);
    const beforeRow = beforeEntry?.row ?? { [label]: '0' };
    const afterRow = afterEntry?.row ?? { [label]: '0' };
    return {
      context_fingerprint: fingerprint(key),
      [label]: gauge(
        beforeRow,
        afterRow,
        label,
        beforeEntry?.rowLabel ?? `before.${field}.missing`,
        afterEntry?.rowLabel ?? `after.${field}.missing`
      ),
    };
  });
}

function cronJobs(snapshot, label) {
  const jobs = snapshot?.cron?.jobs;
  if (!jobs || typeof jobs !== 'object') {
    throw new Error(`${label}.cron.jobs must be an object`);
  }
  return jobs;
}

function cronRuns(snapshot, label) {
  const runs = snapshot?.cron?.runs_last_24h;
  if (!Array.isArray(runs)) {
    throw new Error(`${label}.cron.runs_last_24h must be an array`);
  }
  const mapped = new Map();
  runs.forEach((run, index) => {
    const runLabel = `${label}.cron.runs_last_24h[${index}]`;
    const status = requiredString(run?.status, `${runLabel}.status`);
    if (mapped.has(status)) throw new Error('duplicate cron run status');
    mapped.set(status, { row: run, rowLabel: runLabel });
  });
  return mapped;
}

export function buildOperationalDeltas(before, after) {
  const beforeIo = keyedRows(before, 'io', 'before', ioIdentity);
  const afterIo = keyedRows(after, 'io', 'after', ioIdentity);
  const beforeJobs = cronJobs(before, 'before');
  const afterJobs = cronJobs(after, 'after');
  const beforeRuns = cronRuns(before, 'before');
  const afterRuns = cronRuns(after, 'after');
  const runKeys = new Set([...beforeRuns.keys(), ...afterRuns.keys()]);

  return {
    io: stablePairs(beforeIo, afterIo, 'I/O').map(
      ({ key, before: beforeEntry, after: afterEntry }) => ({
        context_fingerprint: fingerprint(key),
        op_bytes: stableInteger(
          beforeEntry.row,
          afterEntry.row,
          'op_bytes',
          beforeEntry.rowLabel,
          afterEntry.rowLabel
        ),
        counters: exactCounterDeltas(
          beforeEntry.row,
          afterEntry.row,
          IO_COUNTERS,
          beforeEntry.rowLabel,
          afterEntry.rowLabel
        ),
        timings_ms: timingDeltas(
          beforeEntry.row,
          afterEntry.row,
          beforeEntry.rowLabel,
          afterEntry.rowLabel
        ),
      })
    ),
    connections: gaugeRows(
      before,
      after,
      'connections',
      'connections',
      connectionIdentity
    ),
    locks: gaugeRows(before, after, 'locks', 'locks', lockIdentity),
    cron: {
      jobs: {
        active: gauge(
          beforeJobs,
          afterJobs,
          'active',
          'before.cron.jobs',
          'after.cron.jobs'
        ),
        total: gauge(
          beforeJobs,
          afterJobs,
          'total',
          'before.cron.jobs',
          'after.cron.jobs'
        ),
      },
      runs_last_24h: [...runKeys].sort().map((key) => {
        const beforeEntry = beforeRuns.get(key);
        const afterEntry = afterRuns.get(key);
        return {
          context_fingerprint: fingerprint(key),
          runs: rollingGauge(
            beforeEntry?.row ?? { runs: '0' },
            afterEntry?.row ?? { runs: '0' },
            'runs',
            beforeEntry?.rowLabel ?? 'before.cron.runs_last_24h.missing',
            afterEntry?.rowLabel ?? 'after.cron.runs_last_24h.missing'
          ),
        };
      }),
    },
  };
}
