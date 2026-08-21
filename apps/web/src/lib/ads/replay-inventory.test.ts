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
const metaReauthMigrationName =
  '20260821180002_meta_ads_reauth_status.sql' as const;
const metaReauthMigrationHash =
  'f0c8ee6d1f3b7b3e2eb06380c8be94fe797ed9781c1ba00d59b49ea1836b589c' as const;
const metaReauthAllowlistMigrationName =
  '20260821180003_expand_meta_ads_reauth_reason_allowlist.sql' as const;
const metaReauthAllowlistMigrationHash =
  '4312b9ad198bd16bb8bf20191e786e24a34a97f928da5e9031399f6a7da47960' as const;
const snapchatSecurityMigrationName =
  '20260821180004_snapchat_ads_oauth_and_disconnect.sql' as const;
const snapchatSecurityMigrationHash =
  'eac8c22a9d2d2ad1decbde111f60921b880cf478f4123d3441b5e0e291ccb3ca' as const;
const snapchatRefreshMigrationName =
  '20260821180005_snapchat_ads_atomic_refresh_tokens.sql' as const;
const snapchatRefreshMigrationHash =
  'c71e54d8a1ea2af6809ecc50d6e6582358806501eb851f17861dfab611f10359' as const;
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
    expect(
      createHash('sha256')
        .update(
          readFileSync(
            path.resolve(
              process.cwd(),
              `../../supabase/migrations/${metaReauthMigrationName}`
            )
          )
        )
        .digest('hex')
    ).toBe(metaReauthMigrationHash);
    expect(historySources).toContain(
      `${metaReauthMigrationHash} ${metaReauthMigrationName}`
    );
    expect(pendingSources).toContain(metaReauthMigrationName);
    expect(pendingSources).toContain(metaReauthMigrationHash);
    expect(
      createHash('sha256')
        .update(
          readFileSync(
            path.resolve(
              process.cwd(),
              `../../supabase/migrations/${metaReauthAllowlistMigrationName}`
            )
          )
        )
        .digest('hex')
    ).toBe(metaReauthAllowlistMigrationHash);
    expect(historySources).toContain(
      `${metaReauthAllowlistMigrationHash} ${metaReauthAllowlistMigrationName}`
    );
    expect(pendingSources).toContain(metaReauthAllowlistMigrationName);
    expect(pendingSources).toContain(metaReauthAllowlistMigrationHash);
    expect(
      createHash('sha256')
        .update(
          readFileSync(
            path.resolve(
              process.cwd(),
              `../../supabase/migrations/${snapchatSecurityMigrationName}`
            )
          )
        )
        .digest('hex')
    ).toBe(snapchatSecurityMigrationHash);
    expect(historySources).toContain(
      `${snapchatSecurityMigrationHash} ${snapchatSecurityMigrationName}`
    );
    expect(pendingSources).toContain(snapchatSecurityMigrationName);
    expect(pendingSources).toContain(snapchatSecurityMigrationHash);
    expect(
      createHash('sha256')
        .update(
          readFileSync(
            path.resolve(
              process.cwd(),
              `../../supabase/migrations/${snapchatRefreshMigrationName}`
            )
          )
        )
        .digest('hex')
    ).toBe(snapchatRefreshMigrationHash);
    expect(historySources).toContain(
      `${snapchatRefreshMigrationHash} ${snapchatRefreshMigrationName}`
    );
    expect(pendingSources).toContain(snapchatRefreshMigrationName);
    expect(pendingSources).toContain(snapchatRefreshMigrationHash);
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
