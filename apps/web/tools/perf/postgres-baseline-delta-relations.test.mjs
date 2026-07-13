import { describe, expect, it } from 'vitest';
import { buildRelationDeltas } from './postgres-baseline-delta-relations.mjs';
import { createFingerprint } from './postgres-baseline-fingerprint.mjs';

const fingerprint = createFingerprint(
  Buffer.from('baseline-fingerprint-key-material-32-bytes')
);

function table(overrides = {}) {
  return {
    schema_name: 'public',
    table_name: 'orders',
    relid: '100',
    seq_scan: '10',
    seq_tup_read: '20',
    idx_scan: '30',
    idx_tup_fetch: '40',
    n_tup_ins: '50',
    n_tup_upd: '60',
    n_tup_del: '70',
    n_tup_hot_upd: '80',
    n_live_tup: '90',
    n_dead_tup: '10',
    vacuum_count: '2',
    autovacuum_count: '3',
    analyze_count: '4',
    autoanalyze_count: '5',
    table_bytes: '1000',
    indexes_bytes: '2000',
    total_bytes: '3000',
    ...overrides,
  };
}

function index(overrides = {}) {
  return {
    schema_name: 'public',
    table_name: 'orders',
    index_name: 'idx_orders_merchant_id',
    relid: '100',
    indexrelid: '200',
    idx_scan: '20',
    idx_tup_read: '30',
    idx_tup_fetch: '40',
    index_bytes: '500',
    ...overrides,
  };
}

function snapshot(overrides = {}) {
  return {
    tables: [table()],
    indexes: [index()],
    ...overrides,
  };
}

describe('buildRelationDeltas', () => {
  it('emits reset-bounded table and index activity without raw relation names', () => {
    const result = buildRelationDeltas(
      snapshot(),
      snapshot({
        indexes: [
          index({
            idx_scan: '25',
            idx_tup_read: '37',
            idx_tup_fetch: '49',
            index_bytes: '700',
          }),
        ],
        tables: [
          table({
            idx_scan: '33',
            n_dead_tup: '8',
            n_tup_ins: '57',
            seq_scan: '12',
            table_bytes: '1200',
            total_bytes: '3300',
          }),
        ],
      }),
      fingerprint
    );

    expect(result.tables).toMatchObject([
      {
        relation_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        activity_delta: {
          idx_scan: '3',
          n_tup_ins: '7',
          seq_scan: '2',
        },
        gauges: {
          after: { n_dead_tup: '8', table_bytes: '1200', total_bytes: '3300' },
          before: {
            n_dead_tup: '10',
            table_bytes: '1000',
            total_bytes: '3000',
          },
          delta: { n_dead_tup: '-2', table_bytes: '200', total_bytes: '300' },
        },
      },
    ]);
    expect(result.indexes).toMatchObject([
      {
        index_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        relation_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        activity_delta: {
          idx_scan: '5',
          idx_tup_fetch: '9',
          idx_tup_read: '7',
        },
        size_bytes: { after: '700', before: '500', delta: '200' },
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/orders|merchant_id|public/i);
  });

  it.each([
    ['table', snapshot({ tables: [] }), /table.*disappeared/i],
    ['index', snapshot({ indexes: [] }), /index.*disappeared/i],
    [
      'recreated table',
      snapshot({ tables: [table({ relid: '101' })] }),
      /table.*disappeared/i,
    ],
    [
      'recreated index',
      snapshot({ indexes: [index({ indexrelid: '201' })] }),
      /index.*disappeared/i,
    ],
  ])('rejects a %s identity change inside a measured interval', (_kind, after, expected) => {
    expect(() => buildRelationDeltas(snapshot(), after, fingerprint)).toThrow(
      expected
    );
  });
});
