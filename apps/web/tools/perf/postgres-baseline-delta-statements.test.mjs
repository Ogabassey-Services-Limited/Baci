import { describe, expect, it } from 'vitest';
import fixtures from './postgres-baseline-delta.test-fixtures.mjs';

const { END, createDelta, raw, snapshot, statement } = fixtures;

describe('postgres baseline statement deltas', () => {
  it('retains plan-only statements and their local and temporary I/O timings', () => {
    const result = createDelta({
      afterRaw: raw(
        snapshot({
          captured_at: END,
          statements: [
            statement({
              calls: '0',
              local_blk_read_time: '3.5',
              local_blk_write_time: '4.5',
              local_blks_dirtied: '3',
              local_blks_written: '4',
              plans: '2',
              shared_blks_dirtied: '5',
              shared_blks_written: '6',
              temp_blk_read_time: '5.5',
              temp_blk_write_time: '6.5',
              total_plan_time: '8.5',
              total_exec_time: '0',
            }),
          ],
        })
      ),
      beforeRaw: raw(
        snapshot({
          statements: [
            statement({ calls: '0', plans: '0', total_exec_time: '0' }),
          ],
        })
      ),
      deployedSha: 'b'.repeat(40),
    });

    expect(result.statement_deltas).toEqual([
      expect.objectContaining({
        calls: '0',
        local_blk_read_time_ms: 3.5,
        local_blk_write_time_ms: 4.5,
        local_blks_dirtied: '3',
        local_blks_written: '4',
        plans: '2',
        shared_blks_dirtied: '5',
        shared_blks_written: '6',
        temp_blk_read_time_ms: 5.5,
        temp_blk_write_time_ms: 6.5,
        total_plan_time_ms: 7,
      }),
    ]);
  });

  it('preserves every changed statement shape beyond the former summary limit', () => {
    const beforeStatements = Array.from({ length: 51 }, (_, index) =>
      statement({ calls: '1', query: `select ${index}`, total_exec_time: '1' })
    );
    const afterStatements = Array.from({ length: 51 }, (_, index) =>
      statement({
        calls: '2',
        query: `select ${index}`,
        total_exec_time: String(index + 2),
      })
    );

    const result = createDelta({
      afterRaw: raw(
        snapshot({ captured_at: END, statements: afterStatements })
      ),
      beforeRaw: raw(snapshot({ statements: beforeStatements })),
      deployedSha: 'b'.repeat(40),
    });

    expect(result.statement_deltas).toHaveLength(51);
  });

  it.each([
    ['blank string', '', '10'],
    ['boolean', false, '10'],
    ['unsafe number', Number.MAX_SAFE_INTEGER + 1, '9007199254740993'],
  ])('rejects a %s statement integer counter', (_kind, beforeCalls, afterCalls) => {
    expect(() =>
      createDelta({
        afterRaw: raw(
          snapshot({
            captured_at: END,
            statements: [statement({ calls: afterCalls })],
          })
        ),
        beforeRaw: raw(
          snapshot({ statements: [statement({ calls: beforeCalls })] })
        ),
        deployedSha: 'b'.repeat(40),
      })
    ).toThrow(
      /before\.statements\[0\]\.calls must be a non-negative integer string/i
    );
  });

  it.each([
    ['blank string', ''],
    ['whitespace', '  '],
    ['boolean', false],
    ['numeric value', 10.5],
    ['negative string', '-1'],
    ['overflow', '1e309'],
  ])('rejects a %s statement timing counter', (_kind, totalExecTime) => {
    expect(() =>
      createDelta({
        afterRaw: raw(
          snapshot({
            captured_at: END,
            statements: [statement({ total_exec_time: '110.5' })],
          })
        ),
        beforeRaw: raw(
          snapshot({
            statements: [statement({ total_exec_time: totalExecTime })],
          })
        ),
        deployedSha: 'b'.repeat(40),
      })
    ).toThrow(
      /before\.statements\[0\]\.total_exec_time must be a non-negative decimal string/i
    );
  });
});
