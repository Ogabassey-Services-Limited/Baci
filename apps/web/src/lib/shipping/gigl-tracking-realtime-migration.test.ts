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

    const policyBodies = [
      'authorized users receive shipment tracking wakeups',
      'shipment tracking topics require order access',
    ].map((policyName) => {
      const policyBody = migration.match(
        new RegExp(`CREATE POLICY "${policyName}"[\\s\\S]*?;`, 'i')
      )?.[0];
      expect(policyBody).toBeDefined();
      return policyBody ?? '';
    });

    for (const policyBody of policyBodies) {
      expect(
        policyBody.match(/pg_catalog\.substr\(realtime\.topic\(\), 16\)::uuid/g)
      ).toHaveLength(1);
      expect(policyBody).not.toContain(
        'pg_catalog.substring(realtime.topic() FROM 16)'
      );
    }
  });
});
