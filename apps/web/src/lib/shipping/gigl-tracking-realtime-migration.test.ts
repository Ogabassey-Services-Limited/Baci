import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function resolveMigrationPath(relativePath: string) {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

describe('GIGL tracking Realtime migration', () => {
  it('uses valid qualified substring syntax in both order access policies', () => {
    const migration = readFileSync(
      resolveMigrationPath(
        '../../../../../supabase/migrations/20260727220050_shipment_tracking_realtime_broadcast.sql'
      ),
      'utf8'
    );

    expect(
      migration.match(/pg_catalog\.substr\(realtime\.topic\(\), 16\)::uuid/g)
    ).toHaveLength(2);
    expect(migration).not.toContain(
      'pg_catalog.substring(realtime.topic() FROM 16)'
    );
  });
});
