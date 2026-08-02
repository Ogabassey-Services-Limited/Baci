import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function resolveMigrationPath(relativePath: string) {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

function readMigration(filename: string) {
  return readFileSync(
    resolveMigrationPath(`../../../../../supabase/migrations/${filename}`),
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
  });
});
