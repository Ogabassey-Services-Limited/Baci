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
              plans: '2',
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
        plans: '2',
        temp_blk_read_time_ms: 5.5,
        temp_blk_write_time_ms: 6.5,
        total_plan_time_ms: 7,
      }),
    ]);
  });
});
