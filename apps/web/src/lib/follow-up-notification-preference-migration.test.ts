import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260826130000_add_follow_up_notification_preference.sql'
  ),
  'utf8'
);

describe('follow-up notification preference migration', () => {
  it('opts existing and new merchants into follow-up alerts by default', () => {
    expect(migrationSql).toContain(
      'ADD COLUMN IF NOT EXISTS follow_up_notifications_enabled boolean'
    );
    expect(migrationSql).toContain('NOT NULL DEFAULT true');
  });

  it('documents the preference as an event-driven follow-up alert control', () => {
    expect(migrationSql).toContain(
      'event-driven alerts for actionable customer follow-up items'
    );
  });
});
