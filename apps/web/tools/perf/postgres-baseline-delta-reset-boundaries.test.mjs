import { describe, expect, it } from 'vitest';
import fixtures from './postgres-baseline-delta.test-fixtures.mjs';
import { buildStatementDeltas } from './postgres-baseline-delta-statements.mjs';

const { END, createDelta, raw, snapshot, statement } = fixtures;

describe('postgres baseline reset boundary validation', () => {
  it.each([
    'before',
    'after',
  ])('rejects a numeric %s capture timestamp at the delta boundary', (side) => {
    const before = snapshot();
    const after = snapshot({ captured_at: END });
    const selected = side === 'before' ? before : after;
    selected.captured_at = 123;

    expect(() =>
      createDelta({
        afterRaw: raw(after),
        beforeRaw: raw(before),
        deployedSha: 'a'.repeat(40),
      })
    ).toThrow(/must be an ISO timestamp/i);
  });

  it('rejects identical before and after encrypted artifacts', () => {
    const artifact = Buffer.from('same-encrypted-evidence');

    expect(() =>
      createDelta({
        afterArtifact: Buffer.from(artifact),
        afterRaw: raw(snapshot({ captured_at: END })),
        beforeArtifact: artifact,
        beforeRaw: raw(snapshot()),
        deployedSha: 'a'.repeat(40),
      })
    ).toThrow(/encrypted artifacts must be distinct/i);
  });

  it.each([
    ['before', 'not-a-timestamp'],
    ['after', 'not-a-timestamp'],
    ['before', 123],
    ['after', 123],
  ])('rejects an invalid %s statement capture timestamp', (side, invalid) => {
    const before = snapshot();
    const after = snapshot({ captured_at: END });
    const selected = side === 'before' ? before : after;
    selected.captured_at = invalid;

    expect(() => buildStatementDeltas(before, after)).toThrow(
      /captured_at.*ISO timestamp/i
    );
  });

  it.each([
    ['statement', 'statement_stats_reset'],
    ['I/O', 'io_stats_reset'],
    ['WAL', 'wal_stats_reset'],
  ])('rejects a missing %s reset boundary', (_label, boundary) => {
    const statisticsBoundaries = { [boundary]: null };

    expect(() =>
      createDelta({
        afterRaw: raw(
          snapshot({
            captured_at: END,
            statistics_boundaries: statisticsBoundaries,
          })
        ),
        beforeRaw: raw(
          snapshot({ statistics_boundaries: statisticsBoundaries })
        ),
        deployedSha: 'a'.repeat(40),
      })
    ).toThrow(/boundary is missing/i);
  });

  it('rejects a disappeared statement as an incomplete interval', () => {
    const before = snapshot({ statements: [statement()] });
    const after = snapshot({ captured_at: END, statements: [] });

    expect(() => buildStatementDeltas(before, after)).toThrow(
      /disappeared; interval cannot produce a complete delta/i
    );
  });

  it('rejects deallocation before attempting a partial statement delta', () => {
    expect(() =>
      createDelta({
        afterRaw: raw(
          snapshot({
            captured_at: END,
            statements: [],
            statistics_boundaries: { statement_dealloc: '8' },
          })
        ),
        beforeRaw: raw(snapshot({ statements: [statement()] })),
        deployedSha: 'a'.repeat(40),
      })
    ).toThrow(/dealloc changed/i);
  });

  it.each([
    ['track_io_timing', 'off'],
    ['track_wal_io_timing', 'on'],
    ['pg_stat_statements.track', 'top'],
    ['pg_stat_statements.track_planning', 'off'],
  ])('rejects an interval with changed %s', (setting, value) => {
    expect(() =>
      createDelta({
        afterRaw: raw(
          snapshot({ captured_at: END, settings: { [setting]: value } })
        ),
        beforeRaw: raw(snapshot()),
        deployedSha: 'a'.repeat(40),
      })
    ).toThrow(/collection settings change/i);
  });
});
