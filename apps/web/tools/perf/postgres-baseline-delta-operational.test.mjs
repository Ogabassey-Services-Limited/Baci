import { describe, expect, it } from 'vitest';
import fixtures from './postgres-baseline-delta.test-fixtures.mjs';

const { END, connectionRow, createDelta, ioRow, lockRow, raw, snapshot } =
  fixtures;

describe('postgres baseline operational deltas', () => {
  it('emits anonymous I/O, connection, lock deltas, and cron rolling gauges', () => {
    const result = createDelta({
      afterRaw: raw(
        snapshot({
          captured_at: END,
          connections: [connectionRow({ connections: '3' })],
          cron: {
            jobs: { active: '2', total: '4' },
            runs_last_24h: [{ runs: '5', status: 'succeeded' }],
          },
          io: [
            ioRow({
              fsync_time: '7.5',
              reads: '13',
              read_time: '3.5',
              writes: '24',
            }),
          ],
          locks: [lockRow({ locks: '5' })],
        })
      ),
      beforeRaw: raw(snapshot()),
      deployedSha: 'f'.repeat(40),
    });

    expect(result.operational_deltas).toMatchObject({
      connections: [
        {
          context_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
          connections: { after: '3', before: '1', delta: '2' },
        },
      ],
      cron: {
        jobs: {
          active: { after: '2', before: '1', delta: '1' },
          total: { after: '4', before: '2', delta: '2' },
        },
        runs_last_24h: [
          {
            context_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
            runs: { after: '5', before: '3' },
          },
        ],
      },
      io: [
        {
          context_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
          op_bytes: '8192',
          counters: expect.objectContaining({ reads: '3', writes: '4' }),
          timings_ms: expect.objectContaining({ fsync_time: 2, read_time: 2 }),
        },
      ],
      locks: [
        {
          context_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
          locks: { after: '5', before: '2', delta: '3' },
        },
      ],
    });
    expect(JSON.stringify(result.operational_deltas)).not.toMatch(
      /client backend|checkout-worker|relation|AccessShareLock|succeeded/i
    );
    expect(
      result.operational_deltas.cron.runs_last_24h[0].runs
    ).not.toHaveProperty('delta');
  });

  it('rejects I/O counter regressions despite a reset-safe global boundary', () => {
    expect(() =>
      createDelta({
        afterRaw: raw(
          snapshot({ captured_at: END, io: [ioRow({ reads: '9' })] })
        ),
        beforeRaw: raw(snapshot()),
        deployedSha: 'f'.repeat(40),
      })
    ).toThrow(/after\.io\[0\]\.reads regressed/i);
  });

  it('rejects an I/O operation-size change inside a stable context', () => {
    expect(() =>
      createDelta({
        afterRaw: raw(
          snapshot({
            captured_at: END,
            io: [ioRow({ op_bytes: '4096', reads: '13' })],
          })
        ),
        beforeRaw: raw(snapshot()),
        deployedSha: 'f'.repeat(40),
      })
    ).toThrow(/after\.io\[0\]\.op_bytes changed/i);
  });
});
