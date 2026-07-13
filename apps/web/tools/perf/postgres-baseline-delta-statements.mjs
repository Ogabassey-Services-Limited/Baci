import { createHash } from 'node:crypto';

const COUNTERS = [
  'calls',
  'plans',
  'total_plan_time',
  'total_exec_time',
  'rows',
  'shared_blks_hit',
  'shared_blks_read',
  'local_blks_hit',
  'local_blks_read',
  'temp_blks_read',
  'temp_blks_written',
  'blk_read_time',
  'blk_write_time',
  'local_blk_read_time',
  'local_blk_write_time',
  'temp_blk_read_time',
  'temp_blk_write_time',
  'wal_records',
  'wal_fpi',
  'wal_bytes',
];
const DECIMAL_COUNTERS = new Set([
  'total_plan_time',
  'total_exec_time',
  'blk_read_time',
  'blk_write_time',
  'local_blk_read_time',
  'local_blk_write_time',
  'temp_blk_read_time',
  'temp_blk_write_time',
]);

function requiredString(statement, field, label) {
  const value = statement?.[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return value;
}

function normalizedQuery(statement, label) {
  return requiredString(statement, 'query', label).trim().replace(/\s+/g, ' ');
}

function statementFingerprint(statement, label) {
  const databaseName = requiredString(statement, 'database_name', label);
  const roleName = requiredString(statement, 'role_name', label);
  if (typeof statement.toplevel !== 'boolean') {
    throw new Error(`${label}.toplevel must be a boolean`);
  }
  const shape = [
    databaseName,
    roleName,
    statement.toplevel ? 'top' : 'nested',
    normalizedQuery(statement, label),
  ].join('\u001f');
  return createHash('sha256').update(shape).digest('hex');
}

function parseBoundary(statement, label) {
  const statsSince = requiredString(statement, 'stats_since', label);
  const milliseconds = Date.parse(statsSince);
  if (!Number.isFinite(milliseconds)) {
    throw new Error(`${label}.stats_since must be an ISO timestamp`);
  }
  return { milliseconds, value: statsSince };
}

function parseCounter(value, counter, label) {
  if (value == null) {
    throw new Error(`${label}.${counter} is missing`);
  }
  if (DECIMAL_COUNTERS.has(counter)) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`${label}.${counter} must be a non-negative number`);
    }
    return parsed;
  }
  try {
    const parsed = BigInt(value);
    if (parsed < 0n) throw new Error('negative');
    return parsed;
  } catch (error) {
    throw new Error(
      `${label}.${counter} must be a non-negative integer string`,
      {
        cause: error,
      }
    );
  }
}

function emptyTotals() {
  return Object.fromEntries(
    COUNTERS.map((counter) => [counter, DECIMAL_COUNTERS.has(counter) ? 0 : 0n])
  );
}

function addStatement(group, statement, label) {
  group.boundaries.push(parseBoundary(statement, label));
  for (const counter of COUNTERS) {
    group.totals[counter] += parseCounter(statement[counter], counter, label);
  }
}

function statementGroups(snapshot, label) {
  if (!Array.isArray(snapshot.statements)) {
    throw new Error(`${label}.statements must be an array`);
  }
  const groups = new Map();
  snapshot.statements.forEach((statement, index) => {
    const entryLabel = `${label}.statements[${index}]`;
    const key = statementFingerprint(statement, entryLabel);
    const group = groups.get(key) ?? {
      boundaries: [],
      totals: emptyTotals(),
    };
    addStatement(group, statement, entryLabel);
    groups.set(key, group);
  });
  return groups;
}

function boundaryCounts(boundaries) {
  const counts = new Map();
  for (const boundary of boundaries) {
    counts.set(boundary.value, (counts.get(boundary.value) ?? 0) + 1);
  }
  return counts;
}

function validateBoundaries(
  beforeGroup,
  afterGroup,
  intervalStart,
  intervalEnd,
  key
) {
  const remaining = boundaryCounts(afterGroup.boundaries);
  for (const boundary of beforeGroup?.boundaries ?? []) {
    const count = remaining.get(boundary.value) ?? 0;
    if (count === 0) {
      throw new Error(
        `targeted statement reset or entry loss detected for ${key}`
      );
    }
    remaining.set(boundary.value, count - 1);
  }

  for (const [value, count] of remaining) {
    if (count === 0) continue;
    const milliseconds = Date.parse(value);
    if (milliseconds < intervalStart || milliseconds > intervalEnd) {
      throw new Error(`partial statement entry boundary detected for ${key}`);
    }
  }
}

function counterDeltas(beforeGroup, afterGroup, key) {
  return Object.fromEntries(
    COUNTERS.map((counter) => {
      const before =
        beforeGroup?.totals[counter] ??
        (DECIMAL_COUNTERS.has(counter) ? 0 : 0n);
      const after = afterGroup.totals[counter];
      if (after < before) {
        throw new Error(`statement.${key}.${counter} regressed`);
      }
      const delta = after - before;
      return [
        counter,
        DECIMAL_COUNTERS.has(counter)
          ? Number(delta.toFixed(6))
          : delta.toString(),
      ];
    })
  );
}

function resultRow(key, delta) {
  const calls = BigInt(delta.calls);
  const plans = BigInt(delta.plans);
  return {
    statement_fingerprint: key,
    calls: delta.calls,
    plans: delta.plans,
    total_plan_time_ms: delta.total_plan_time,
    mean_plan_time_ms:
      plans === 0n
        ? 0
        : Number((Number(delta.total_plan_time) / Number(plans)).toFixed(3)),
    total_exec_time_ms: delta.total_exec_time,
    mean_exec_time_ms:
      calls === 0n
        ? 0
        : Number((Number(delta.total_exec_time) / Number(calls)).toFixed(3)),
    rows: delta.rows,
    shared_blks_hit: delta.shared_blks_hit,
    shared_blks_read: delta.shared_blks_read,
    local_blks_hit: delta.local_blks_hit,
    local_blks_read: delta.local_blks_read,
    temp_blks_read: delta.temp_blks_read,
    temp_blks_written: delta.temp_blks_written,
    blk_read_time_ms: delta.blk_read_time,
    blk_write_time_ms: delta.blk_write_time,
    local_blk_read_time_ms: delta.local_blk_read_time,
    local_blk_write_time_ms: delta.local_blk_write_time,
    temp_blk_read_time_ms: delta.temp_blk_read_time,
    temp_blk_write_time_ms: delta.temp_blk_write_time,
    wal_records: delta.wal_records,
    wal_fpi: delta.wal_fpi,
    wal_bytes: delta.wal_bytes,
  };
}

export function buildStatementDeltas(before, after) {
  const intervalStart =
    typeof before.captured_at === 'string'
      ? Date.parse(before.captured_at)
      : Number.NaN;
  const intervalEnd =
    typeof after.captured_at === 'string'
      ? Date.parse(after.captured_at)
      : Number.NaN;
  if (!Number.isFinite(intervalStart) || !Number.isFinite(intervalEnd)) {
    throw new Error('captured_at must be an ISO timestamp on both snapshots');
  }
  const beforeByShape = statementGroups(before, 'before');
  const afterByShape = statementGroups(after, 'after');

  for (const key of beforeByShape.keys()) {
    if (!afterByShape.has(key)) {
      throw new Error(
        `statement ${key} disappeared; interval cannot produce a complete delta`
      );
    }
  }

  return [...afterByShape.entries()]
    .map(([key, afterGroup]) => {
      const beforeGroup = beforeByShape.get(key);
      validateBoundaries(
        beforeGroup,
        afterGroup,
        intervalStart,
        intervalEnd,
        key
      );
      return resultRow(key, counterDeltas(beforeGroup, afterGroup, key));
    })
    .filter((statement) => statement.calls !== '0' || statement.plans !== '0')
    .sort(
      (left, right) =>
        right.total_exec_time_ms +
        right.total_plan_time_ms -
        (left.total_exec_time_ms + left.total_plan_time_ms)
    )
    .slice(0, 50);
}
