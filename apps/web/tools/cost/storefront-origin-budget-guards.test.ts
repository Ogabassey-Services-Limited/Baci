import { chmod, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parseStorefrontOriginBudgetArguments,
  readSealedStorefrontDeliveryManifest,
} from './storefront-origin-budget';
import {
  manifest,
  seal,
  summarizeAtFixtureTime,
  validationNow,
} from './storefront-origin-budget.test-fixtures';
import {
  calculateStorefrontDeliveryManifestAuthoritySha256,
  type StorefrontDeliveryManifestAuthorityResolver,
} from './storefront-origin-budget-authority';

const authorityFor =
  (
    evidence: ReturnType<typeof seal>
  ): StorefrontDeliveryManifestAuthorityResolver =>
  () => ({
    source: 'audit_verified',
    manifestSha256:
      calculateStorefrontDeliveryManifestAuthoritySha256(evidence),
    authorityReceiptSha256: 'a'.repeat(64),
    verifiedAt: validationNow.toISOString(),
  });
const production = { environment: 'production' as const };

describe('storefront origin budget guards', () => {
  it('accepts production and comparison parser forms', () => {
    expect(
      parseStorefrontOriginBudgetArguments(['--manifest', '/tmp/sealed.json'])
    ).toEqual({
      manifestPath: '/tmp/sealed.json',
      environment: 'production',
    });
    expect(
      parseStorefrontOriginBudgetArguments([
        '--manifest',
        '/tmp/sealed.json',
        '--environment',
        'comparison',
        '--threshold',
        '0.01',
      ])
    ).toEqual({
      manifestPath: '/tmp/sealed.json',
      environment: 'comparison',
      thresholdOverride: 0.01,
    });
  });

  it('rejects malformed parser options and unsafe production overrides', () => {
    for (const args of [
      [],
      ['--manifest'],
      ['--manifest', '/tmp/sealed.json', '--environment', 'staging'],
      ['--manifest', '/tmp/sealed.json', '--threshold', '-1'],
      ['--manifest', '/tmp/sealed.json', '--environment', 'comparison'],
      [
        '--manifest',
        '/tmp/sealed.json',
        '--environment',
        'production',
        '--threshold',
        '0.01',
      ],
    ]) {
      expect(() => parseStorefrontOriginBudgetArguments(args)).toThrow();
    }
  });

  it('rejects relative, public, symlinked, and malformed sealed manifests', async () => {
    await expect(
      readSealedStorefrontDeliveryManifest('relative.json', production)
    ).rejects.toThrow('absolute canonical');

    const directory = await mkdtemp(join(tmpdir(), 'baci-origin-guards-'));
    await chmod(directory, 0o700);
    const publicPath = join(directory, 'public.json');
    await writeFile(publicPath, '{}', { mode: 0o644 });
    await chmod(publicPath, 0o644);
    await expect(
      readSealedStorefrontDeliveryManifest(publicPath, production)
    ).rejects.toThrow('private regular file');

    const sealedPath = join(directory, 'sealed.json');
    await writeFile(sealedPath, '{', { mode: 0o600 });
    const symlinkPath = join(directory, 'linked.json');
    await symlink(sealedPath, symlinkPath);
    await expect(
      readSealedStorefrontDeliveryManifest(symlinkPath, production)
    ).rejects.toThrow('symlink');
    await expect(
      readSealedStorefrontDeliveryManifest(sealedPath, production)
    ).rejects.toThrow();
  });
});

describe('summarizeStorefrontDelivery guards', () => {
  it('returns not proven for sampling, count mismatch, alias redirect mismatch, missing day, config drift, or zero ingress', () => {
    for (const change of [
      (m: ReturnType<typeof manifest>) => {
        m.days[0].maxSampleInterval = 2;
      },
      (m: ReturnType<typeof manifest>) => {
        m.days[0].totalDecisionCount = 999;
      },
      (m: ReturnType<typeof manifest>) => {
        m.days[0].aliasEligibleRequestCount = 1;
      },
      (m: ReturnType<typeof manifest>) => {
        m.days.pop();
      },
      (m: ReturnType<typeof manifest>) => {
        m.days[0].wafRulesetVersion = 'drift';
      },
      (m: ReturnType<typeof manifest>) =>
        m.days.forEach((day) => {
          day.canonicalEligibleRequestCount = 0;
          day.aliasEligibleRequestCount = 0;
        }),
    ]) {
      const evidence = manifest();
      change(evidence);
      expect(summarizeAtFixtureTime(seal(evidence)).verdict).toBe('NOT_PROVEN');
    }
  });

  it('returns not proven when decision classifications do not reconcile with invocations', () => {
    const malformed = manifest();
    malformed.days[0].edgeReleaseCount = 0;
    expect(summarizeAtFixtureTime(seal(malformed)).verdict).toBe('NOT_PROVEN');
  });

  it('returns not proven when an independent source is estimated, incomplete, or sampled', () => {
    const evidence = manifest();
    evidence.days[0].sourceEvidence.originEvent.exact = false;
    expect(summarizeAtFixtureTime(seal(evidence)).verdict).toBe('NOT_PROVEN');
  });

  it('reads only an audited sealed manifest and rejects production threshold overrides', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'baci-manifest-'));
    await chmod(directory, 0o700);
    const path = join(directory, 'sealed.json');
    const evidence = manifest();
    await writeFile(path, JSON.stringify(evidence), { mode: 0o600 });
    await expect(
      readSealedStorefrontDeliveryManifest(path, {
        environment: 'production',
        now: validationNow,
        manifestAuthority: authorityFor(evidence),
      })
    ).resolves.toMatchObject({ canonicalHostname: 'ogabassey.com' });
    await expect(
      readSealedStorefrontDeliveryManifest(path, {
        environment: 'production',
        thresholdOverride: 0.1,
      })
    ).rejects.toThrow('overrides');
  });

  it('rejects a self-consistent production manifest without independent authority', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'baci-manifest-auth-'));
    await chmod(directory, 0o700);
    const path = join(directory, 'sealed.json');
    const evidence = manifest();
    await writeFile(path, JSON.stringify(evidence), { mode: 0o600 });

    await expect(
      readSealedStorefrontDeliveryManifest(path, {
        environment: 'production',
        now: validationNow,
      })
    ).rejects.toThrow('authority is required');
    await expect(
      readSealedStorefrontDeliveryManifest(path, {
        environment: 'production',
        now: validationNow,
        manifestAuthority: authorityFor({
          ...evidence,
          deploymentId: 'fabricated',
        }),
      })
    ).rejects.toThrow('does not match');
  });
});
