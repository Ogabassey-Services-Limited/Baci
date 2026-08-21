import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationName =
  '20260821180000_provider_neutral_ads_storage.sql' as const;
const migrationHash =
  '1bc92dcee4cef48f4a30747ee378c81c3f0483e573d159df3b367bf7edee632d' as const;
const hardeningMigrationName =
  '20260821180001_harden_provider_neutral_ads_rpcs.sql' as const;
const hardeningMigrationHash =
  'c5dc059fe41ebed2824b0d9b6275bd8d58b691c5cb561fc039bb80348834d563' as const;
const prerequisiteMigrations = [
  '20260821171051_google_ads_connections_and_spend.sql',
  '20260821174945_google_ads_secret_rpcs.sql',
] as const;

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
    expect(
      createHash('sha256')
        .update(
          readFileSync(
            path.resolve(
              process.cwd(),
              `../../supabase/migrations/${hardeningMigrationName}`
            )
          )
        )
        .digest('hex')
    ).toBe(hardeningMigrationHash);
    expect(historySources).toContain(
      `${hardeningMigrationHash} ${hardeningMigrationName}`
    );
    expect(pendingSources).toContain(hardeningMigrationName);
    expect(pendingSources).toContain(hardeningMigrationHash);
  });

  it('ships and orders the Google baseline before provider-neutral storage', () => {
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

    for (const prerequisite of prerequisiteMigrations) {
      expect(
        readFileSync(
          path.resolve(
            process.cwd(),
            `../../supabase/migrations/${prerequisite}`
          ),
          'utf8'
        )
      ).not.toBe('');
      expect(historySources).toContain(prerequisite);
      expect(pendingSources).toContain(prerequisite);
      expect(historySources.indexOf(prerequisite)).toBeLessThan(
        historySources.indexOf(migrationName)
      );
    }
  });
});
