const TABLE_ACTIVITY_COUNTERS = [
  'seq_scan',
  'seq_tup_read',
  'idx_scan',
  'idx_tup_fetch',
  'n_tup_ins',
  'n_tup_upd',
  'n_tup_del',
  'n_tup_hot_upd',
  'vacuum_count',
  'autovacuum_count',
  'analyze_count',
  'autoanalyze_count',
];
const TABLE_GAUGES = [
  'n_live_tup',
  'n_dead_tup',
  'table_bytes',
  'indexes_bytes',
  'total_bytes',
];
const INDEX_ACTIVITY_COUNTERS = ['idx_scan', 'idx_tup_read', 'idx_tup_fetch'];
const INDEX_SIZE = ['index_bytes'];

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

function relationKey(row, label) {
  return [
    requiredString(row?.relid, `${label}.relid`),
    requiredString(row?.schema_name, `${label}.schema_name`),
    requiredString(row?.table_name, `${label}.table_name`),
  ].join('\u001f');
}

function indexKey(row, label) {
  return [
    relationKey(row, label),
    requiredString(row?.indexrelid, `${label}.indexrelid`),
    requiredString(row?.index_name, `${label}.index_name`),
  ].join('\u001f');
}

function rowsByKey(snapshot, field, kind, keyForRow) {
  const rows = snapshot?.[field];
  if (!Array.isArray(rows)) throw new Error(`${kind} rows must be an array`);
  const mapped = new Map();
  rows.forEach((row, index) => {
    const label = `${kind}[${index}]`;
    const key = keyForRow(row, label);
    if (mapped.has(key)) throw new Error(`duplicate ${kind} identity`);
    mapped.set(key, { label, row });
  });
  return mapped;
}

function stablePairs(beforeRows, afterRows, kind) {
  for (const key of beforeRows.keys()) {
    if (!afterRows.has(key)) throw new Error(`${kind} relation disappeared`);
  }
  for (const key of afterRows.keys()) {
    if (!beforeRows.has(key)) throw new Error(`${kind} relation appeared`);
  }
  return [...beforeRows.keys()].sort().map((key) => ({
    key,
    before: beforeRows.get(key),
    after: afterRows.get(key),
  }));
}

function values(row, fields, label) {
  return Object.fromEntries(
    fields.map((field) => [field, integer(row[field], `${label}.${field}`)])
  );
}

function cumulativeDeltas(before, after, fields, beforeLabel, afterLabel) {
  const beforeValues = values(before, fields, beforeLabel);
  const afterValues = values(after, fields, afterLabel);
  return Object.fromEntries(
    fields.map((field) => {
      if (afterValues[field] < beforeValues[field]) {
        throw new Error(`${afterLabel}.${field} regressed`);
      }
      return [field, (afterValues[field] - beforeValues[field]).toString()];
    })
  );
}

function gaugeSummary(before, after, fields, beforeLabel, afterLabel) {
  const beforeValues = values(before, fields, beforeLabel);
  const afterValues = values(after, fields, afterLabel);
  return {
    before: Object.fromEntries(
      fields.map((field) => [field, beforeValues[field].toString()])
    ),
    after: Object.fromEntries(
      fields.map((field) => [field, afterValues[field].toString()])
    ),
    delta: Object.fromEntries(
      fields.map((field) => [
        field,
        (afterValues[field] - beforeValues[field]).toString(),
      ])
    ),
  };
}

export function buildRelationDeltas(before, after, fingerprint) {
  if (typeof fingerprint !== 'function') {
    throw new Error('fingerprint must be a keyed function');
  }
  const beforeTables = rowsByKey(before, 'tables', 'table', relationKey);
  const afterTables = rowsByKey(after, 'tables', 'table', relationKey);
  const beforeIndexes = rowsByKey(before, 'indexes', 'index', indexKey);
  const afterIndexes = rowsByKey(after, 'indexes', 'index', indexKey);

  return {
    tables: stablePairs(beforeTables, afterTables, 'table').map(
      ({ key, before: beforeEntry, after: afterEntry }) => ({
        relation_fingerprint: fingerprint(key),
        activity_delta: cumulativeDeltas(
          beforeEntry.row,
          afterEntry.row,
          TABLE_ACTIVITY_COUNTERS,
          beforeEntry.label,
          afterEntry.label
        ),
        gauges: gaugeSummary(
          beforeEntry.row,
          afterEntry.row,
          TABLE_GAUGES,
          beforeEntry.label,
          afterEntry.label
        ),
      })
    ),
    indexes: stablePairs(beforeIndexes, afterIndexes, 'index').map(
      ({ key, before: beforeEntry, after: afterEntry }) => {
        const relation = relationKey(beforeEntry.row, beforeEntry.label);
        const sizeSummary = gaugeSummary(
          beforeEntry.row,
          afterEntry.row,
          INDEX_SIZE,
          beforeEntry.label,
          afterEntry.label
        );
        return {
          relation_fingerprint: fingerprint(relation),
          index_fingerprint: fingerprint(key),
          activity_delta: cumulativeDeltas(
            beforeEntry.row,
            afterEntry.row,
            INDEX_ACTIVITY_COUNTERS,
            beforeEntry.label,
            afterEntry.label
          ),
          size_bytes: {
            before: sizeSummary.before.index_bytes,
            after: sizeSummary.after.index_bytes,
            delta: sizeSummary.delta.index_bytes,
          },
        };
      }
    ),
  };
}
