import { chmod, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parseStorefrontOriginBudgetArguments,
  readSealedStorefrontDeliveryManifest,
} from './storefront-origin-budget';

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
