const COLLECTION_SETTING_KEYS = [
  'max_connections',
  'shared_buffers',
  'work_mem',
  'track_io_timing',
  'track_wal_io_timing',
  'pg_stat_statements.max',
  'pg_stat_statements.track',
  'pg_stat_statements.track_planning',
];

function requireSame(before, after, path, message, allowNull = false) {
  const left = path.reduce((value, key) => value?.[key], before);
  const right = path.reduce((value, key) => value?.[key], after);
  if (
    left === undefined ||
    right === undefined ||
    (!allowNull && (left === null || right === null))
  ) {
    throw new Error(`${message} boundary is missing`);
  }
  if (left !== right && String(left) !== String(right))
    throw new Error(message);
  return left === null ? null : String(left);
}

export function validateIntervalSafety(before, after) {
  requireSame(
    before,
    after,
    ['server', 'database_name'],
    'interval crosses a database identity change'
  );
  return {
    postmaster_started_at: requireSame(
      before,
      after,
      ['server', 'postmaster_started_at'],
      'interval crosses a server restart'
    ),
    server_version_num: requireSame(
      before,
      after,
      ['server', 'server_version_num'],
      'interval crosses a server version change'
    ),
    server_build: requireSame(
      before,
      after,
      ['server', 'server_build'],
      'interval crosses a server build change'
    ),
    collection_settings: Object.fromEntries(
      COLLECTION_SETTING_KEYS.map((key) => [
        key,
        requireSame(
          before,
          after,
          ['settings', key],
          'interval crosses a collection settings change'
        ),
      ])
    ),
    database_stats_reset: requireSame(
      before,
      after,
      ['statistics_boundaries', 'database_stats_reset'],
      'interval crosses a database statistics reset',
      true
    ),
    statement_stats_reset: requireSame(
      before,
      after,
      ['statistics_boundaries', 'statement_stats_reset'],
      'interval crosses a statement statistics reset'
    ),
    statement_dealloc: requireSame(
      before,
      after,
      ['statistics_boundaries', 'statement_dealloc'],
      'pg_stat_statements dealloc changed during interval'
    ),
    io_stats_reset: requireSame(
      before,
      after,
      ['statistics_boundaries', 'io_stats_reset'],
      'interval crosses an I/O statistics reset'
    ),
    wal_stats_reset: requireSame(
      before,
      after,
      ['statistics_boundaries', 'wal_stats_reset'],
      'interval crosses a WAL statistics reset'
    ),
  };
}
