import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function resolveMigrationPath(relativePath: string) {
  const modulePath = fileURLToPath(import.meta.url).replace(/^\/@fs(?=\/)/, '');
  return resolve(dirname(modulePath), relativePath);
}

function readMigration(filename: string) {
  return readFileSync(
    resolveMigrationPath(`../../../../../supabase/migrations/${filename}`),
    'utf8'
  );
}

function readDatabaseTest(filename: string) {
  return readFileSync(
    resolveMigrationPath(
      `../../../../../supabase/migrations/tests/${filename}`
    ),
    'utf8'
  );
}

describe('GIGL definitive notification rejection migration', () => {
  it('keeps provider rejections retryable through the completion RPC', () => {
    const migration = readMigration(
      '20260801142400_retry_gigl_definitive_notification_rejections.sql'
    );

    for (const requirement of [
      "p_outcome NOT IN ('sent', 'skipped', 'failed', 'rejected')",
      "p_outcome = 'rejected'",
      "THEN 'pending'",
      'delivery_started_at = CASE',
      "interval '5 minutes'",
      'TO service_role',
    ]) {
      expect(migration).toContain(requirement);
    }

    const databaseTest = readDatabaseTest(
      'gigl_tracking_notification_rejections.sql'
    );
    expect(databaseTest).toContain(
      'public.complete_shipment_tracking_notification('
    );
    expect(databaseTest).toContain("'rejected'");
    expect(databaseTest).toContain("v_status IS DISTINCT FROM 'pending'");
    expect(databaseTest).toContain('v_delivery_started_at IS NOT NULL');
  });
});
