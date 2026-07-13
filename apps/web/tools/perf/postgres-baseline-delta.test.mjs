import { describe, expect, it } from 'vitest';
import { createPostgresBaselineDelta } from './postgres-baseline-delta.mjs';
import fixtures from './postgres-baseline-delta.test-fixtures.mjs';

const { END, START, createDelta, raw, sha256, snapshot, statement } = fixtures;

describe('createPostgresBaselineDelta', () => {
  it('matches statements by normalized shape instead of queryid and preserves exact integer deltas', () => {
    const beforeRaw = raw(snapshot());
    const afterRaw = raw(
      snapshot({
        captured_at: END,
        database: {
          temp_bytes: '9007199254741999',
          temp_files: '7',
          tup_returned: '9007199254745993',
          xact_commit: '160',
        },
        statements: [
          statement({
            calls: '14',
            query: ' select  id  from public.products\nwhere merchant_id = $1 ',
            queryid: '999999',
            rows: '32',
            shared_blks_hit: '1120',
            shared_blks_read: '14',
            temp_blks_read: '5',
            temp_blks_written: '8',
            total_exec_time: '152.5',
            total_plan_time: '2.5',
            wal_bytes: '1024',
            wal_fpi: '2',
            wal_records: '8',
          }),
        ],
        wal: {
          wal_bytes: '8192',
          wal_fpi: '12',
          wal_records: '140',
        },
      })
    );
    const beforeEncrypted = Buffer.from('age-encrypted-before');
    const afterEncrypted = Buffer.from('age-encrypted-after');

    const result = createDelta({
      afterArtifact: afterEncrypted,
      afterRaw,
      beforeArtifact: beforeEncrypted,
      beforeRaw,
      deployedSha: 'a'.repeat(40),
    });

    expect(result.interval).toMatchObject({
      duration_seconds: 86_400,
      end: END,
      start: START,
    });
    expect(result.database_aggregates.delta).toMatchObject({
      temp_bytes: '1006',
      temp_files: '3',
      tup_returned: '9007199254740993',
      xact_commit: '60',
    });
    expect(result.database_aggregates.per_day_exact).toMatchObject({
      temp_bytes: '1006',
      tup_returned: '9007199254740993',
    });
    expect(result.statement_deltas).toEqual([
      expect.objectContaining({
        calls: '4',
        mean_exec_time_ms: 13,
        rows: '12',
        temp_blks_written: '5',
        total_exec_time_ms: 52,
        wal_bytes: '512',
      }),
    ]);
    expect(result.raw_exports).toEqual({
      after: { sha256: sha256(afterEncrypted), source: 'encrypted_artifact' },
      before: { sha256: sha256(beforeEncrypted), source: 'encrypted_artifact' },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /merchant_id|authenticated|queryid|999999|must-not-persist|database_name/
    );
  });

  it('unwraps the single-row SQL editor JSON export shape', () => {
    const beforeRaw = raw([{ snapshot: snapshot() }]);
    const afterRaw = raw([
      {
        snapshot: snapshot({
          captured_at: END,
          database: { xact_commit: '101' },
        }),
      },
    ]);

    const result = createDelta({
      afterRaw,
      beforeRaw,
      deployedSha: 'b'.repeat(40),
    });

    expect(result.database_aggregates.delta.xact_commit).toBe('1');
  });

  it('aggregates duplicate normalized shapes without using queryid as the key', () => {
    const beforeStatements = [
      statement(),
      statement({
        calls: '5',
        queryid: '222',
        stats_since: '2026-07-02T00:00:00.000Z',
        total_exec_time: '40',
      }),
    ];
    const afterStatements = [
      statement({ calls: '12', queryid: '888', total_exec_time: '120.5' }),
      statement({
        calls: '8',
        queryid: '999',
        stats_since: '2026-07-02T00:00:00.000Z',
        total_exec_time: '64',
      }),
    ];

    const result = createDelta({
      afterRaw: raw(
        snapshot({ captured_at: END, statements: afterStatements })
      ),
      beforeRaw: raw(snapshot({ statements: beforeStatements })),
      deployedSha: 'b'.repeat(40),
    });

    expect(result.statement_deltas).toEqual([
      expect.objectContaining({
        calls: '5',
        mean_exec_time_ms: 8.8,
        total_exec_time_ms: 44,
      }),
    ]);
  });

  const missingCalls = statement({ calls: undefined });

  it.each([
    [
      'database statistics reset',
      { statistics_boundaries: { database_stats_reset: END } },
      /database statistics reset/i,
    ],
    [
      'statement statistics reset',
      { statistics_boundaries: { statement_stats_reset: END } },
      /statement statistics reset/i,
    ],
    [
      'statement eviction',
      { statistics_boundaries: { statement_dealloc: '8' } },
      /dealloc/i,
    ],
    [
      'I/O statistics reset',
      { statistics_boundaries: { io_stats_reset: END } },
      /I\/O statistics reset/i,
    ],
    [
      'WAL statistics reset',
      { statistics_boundaries: { wal_stats_reset: END } },
      /WAL statistics reset/i,
    ],
    ['missing DB', { database: { xact_commit: undefined } }, /missing/i],
    ['missing stmt', { statements: [missingCalls] }, /missing/i],
    [
      'missing statement array',
      { statements: undefined },
      /statements.*array/i,
    ],
    [
      'missing statement database',
      { statements: [statement({ database_name: undefined })] },
      /database_name/i,
    ],
    [
      'missing statement role',
      { statements: [statement({ role_name: '' })] },
      /role_name/i,
    ],
    [
      'invalid statement level',
      { statements: [statement({ toplevel: 'true' })] },
      /toplevel/i,
    ],
    [
      'missing statement boundary',
      { statements: [statement({ stats_since: undefined })] },
      /stats_since/i,
    ],
    [
      'targeted statement reset',
      { statements: [statement({ stats_since: END })] },
      /targeted.*reset/i,
    ],
    ['server restart', { server: { postmaster_started_at: END } }, /restart/i],
    [
      'server build change',
      { server: { server_build: 'PostgreSQL 17.6 Supabase build 17.6.1.141' } },
      /server build/i,
    ],
    [
      'database identity change',
      { server: { database_name: 'another_database' } },
      /database identity/i,
    ],
  ])('rejects an interval crossing a %s', (_label, change, expected) => {
    expect(() =>
      createDelta({
        afterRaw: raw(snapshot({ captured_at: END, ...change })),
        beforeRaw: raw(snapshot()),
        deployedSha: 'c'.repeat(40),
      })
    ).toThrow(expected);
  });

  it('rejects regressed cumulative counters instead of emitting a misleading delta', () => {
    expect(() =>
      createDelta({
        afterRaw: raw(
          snapshot({
            captured_at: END,
            database: { xact_commit: '99' },
          })
        ),
        beforeRaw: raw(snapshot()),
        deployedSha: 'd'.repeat(40),
      })
    ).toThrow(/xact_commit.*regressed/i);
  });

  it('rejects invalid deployment identifiers and non-forward intervals', () => {
    expect(() =>
      createDelta({
        afterRaw: raw(snapshot({ captured_at: END })),
        beforeRaw: raw(snapshot()),
        deployedSha: 'main',
      })
    ).toThrow(/40-character/i);

    expect(() =>
      createDelta({
        afterRaw: raw(snapshot()),
        beforeRaw: raw(snapshot()),
        deployedSha: 'e'.repeat(40),
      })
    ).toThrow(/after.*later/i);
  });

  it('requires a non-empty encrypted artifact pair for programmatic callers', () => {
    const options = {
      afterRaw: raw(snapshot({ captured_at: END })),
      beforeRaw: raw(snapshot()),
      deployedSha: 'e'.repeat(40),
    };

    expect(() => createPostgresBaselineDelta(options)).toThrow(
      /encrypted artifact pair/i
    );
    expect(() =>
      createPostgresBaselineDelta({
        ...options,
        afterArtifact: Buffer.from('encrypted-after'),
        beforeArtifact: Buffer.alloc(0),
      })
    ).toThrow(/encrypted artifact pair/i);
  });

  it('marks client percentiles and errors as separately collected evidence', () => {
    const result = createDelta({
      afterRaw: raw(snapshot({ captured_at: END })),
      beforeRaw: raw(snapshot()),
      deployedSha: 'f'.repeat(40),
    });

    expect(result.client_telemetry).toEqual({
      included: false,
      required_for: ['p50', 'p95', 'p99', 'errors', 'timeouts', 'throughput'],
    });
    expect(result.database_aggregates).not.toHaveProperty('p95');
  });
});
