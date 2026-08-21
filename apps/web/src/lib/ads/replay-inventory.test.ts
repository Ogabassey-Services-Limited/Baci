import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationName =
  '20260821180000_provider_neutral_ads_storage.sql' as const;
const migrationHash =
  '1bc92dcee4cef48f4a30747ee378c81c3f0483e573d159df3b367bf7edee632d' as const;

describe('provider-neutral ads migration replay inventory', () => {
  it('registers the exact migration hash in both replay source inventories', () => {
    const migration = readFileSync(
      path.resolve(process.cwd(), `../../supabase/migrations/${migrationName}`)
    );
    const historySources = readFileSync(
      path.resolve(
        process.cwd(),
        'tools/db/supabase-history-replay-sources.ts'
      ),
      'utf8'
    );
    const pendingSources = readFileSync(
      path.resolve(
        process.cwd(),
        'tools/db/recent-pending-sources.test-fixture.ts'
      ),
      'utf8'
    );

    expect(createHash('sha256').update(migration).digest('hex')).toBe(
      migrationHash
    );
    expect(historySources).toContain(`${migrationHash} ${migrationName}`);
    expect(pendingSources).toContain(migrationName);
    expect(pendingSources).toContain(migrationHash);
  });
});
