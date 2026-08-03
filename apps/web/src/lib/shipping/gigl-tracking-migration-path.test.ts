import { basename } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveGiglTrackingMigrationPath } from './gigl-tracking-migration-path';

describe('resolveGiglTrackingMigrationPath', () => {
  it('resolves the exact migration filename without constructing a regex', () => {
    const filename = '20260727220000_gigl_tracking_monitor_tables.sql';

    const resolvedPath = resolveGiglTrackingMigrationPath(
      `../../../../../supabase/migrations/${filename}`,
      filename
    );

    expect(basename(resolvedPath)).toBe(filename);
  });

  it('rejects a path whose basename differs from the expected filename', () => {
    expect(() =>
      resolveGiglTrackingMigrationPath(
        '../../../../../supabase/migrations/other.sql',
        'expected.sql'
      )
    ).toThrow('Unexpected GIGL tracking migration path: other.sql');
  });
});
