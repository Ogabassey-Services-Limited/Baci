import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  buildQualificationArtifactReceipt,
  validateQualificationWorkerConfig,
} from './qualification-artifact-receipt';
import versionA from './version-a';
import versionB from './version-b';

const root = resolve(import.meta.dirname, '..');
describe('cloudflare evidence qualification worker fixture', () => {
  it('produces distinct deterministic 204 artifact receipts and metadata headers', async () => {
    const [responseA, responseB] = await Promise.all([
      versionA.fetch(
        new Request('https://edge-evidence.ogabassey.com/__baci-evidence/a', {
          headers: {
            'X-Baci-Evidence-Probe': '1',
            'X-Baci-Evidence-Run': 'a'.repeat(32),
          },
        }),
        { CF_VERSION_METADATA: { id: 'provider-a' } } as Env
      ),
      versionB.fetch(
        new Request('https://edge-evidence.ogabassey.com/__baci-evidence/b', {
          headers: {
            'X-Baci-Evidence-Probe': '1',
            'X-Baci-Evidence-Run': 'b'.repeat(32),
          },
        }),
        { CF_VERSION_METADATA: { id: 'provider-b' } } as Env
      ),
    ]);
    expect(responseA.status).toBe(204);
    expect(responseB.status).toBe(204);
    expect(responseA.headers.get('X-Baci-Evidence-Bundle')).toBe(
      'version-a-204'
    );
    expect(responseB.headers.get('X-Baci-Evidence-Bundle')).toBe(
      'version-b-204'
    );
    expect(responseA.headers.get('X-Baci-Evidence-Version')).toBe('provider-a');
    expect(responseB.headers.get('X-Baci-Evidence-Version')).toBe('provider-b');
  });
  it('fails closed for arbitrary host, path, method, or probe identity', async () => {
    const response = await versionA.fetch(
      new Request('https://edge-evidence.ogabassey.com/not-a-probe'),
      { CF_VERSION_METADATA: { id: 'provider-a' } } as Env
    );
    expect(response.status).toBe(404);
  });
  it('runs both injected dry-run artifacts and seals deterministic unequal receipts', async () => {
    const calls: string[] = [];
    const runner = {
      dryRun: async (configPath: string, outputDirectory: string) => {
        calls.push(`${configPath}:${outputDirectory}`);
        const version = configPath.includes('version-a') ? 'a' : 'b';
        return {
          bundle: new TextEncoder().encode(`bundle-${version}`),
          moduleList: [`src/version-${version}.ts`],
          generatedTypeDeclaration: `declare const ${version}: string`,
          wranglerVersion: '4.115.0',
        };
      },
    };
    const [receiptA, receiptB] = await Promise.all([
      buildQualificationArtifactReceipt(root, 'a', runner),
      buildQualificationArtifactReceipt(root, 'b', runner),
    ]);
    expect(calls).toHaveLength(2);
    expect(receiptA.bundleSha256).not.toBe(receiptB.bundleSha256);
    expect(receiptA.canonicalSourceSha256).not.toBe(
      receiptB.canonicalSourceSha256
    );
    expect(receiptA.soleVersionMetadataBinding).toBe('CF_VERSION_METADATA');
    expect(receiptA.wranglerVersion).toBe('4.115.0');
  });
  it('parses JSONC comments, trailing commas, and double slashes inside strings', () => {
    const config = `{
      // The qualification fixture has no provider route.
      "name": "baci-evidence-qualification",
      "main": "src/version-a.ts",
      /* Wrangler accepts trailing commas in JSONC. */
      "compatibility_date": "2026-07-31",
      "version_metadata": { "binding": "CF_VERSION_METADATA", },
    }`;
    expect(
      validateQualificationWorkerConfig(config, 'src/version-a.ts')
    ).toMatchObject({
      binding: 'CF_VERSION_METADATA',
    });
  });
  it('accepts only the exact single generated version-metadata config binding', () => {
    const config = JSON.stringify({
      name: 'baci-evidence-qualification',
      main: 'src/version-a.ts',
      compatibility_date: '2026-07-31',
      version_metadata: { binding: 'CF_VERSION_METADATA' },
    });
    expect(validateQualificationWorkerConfig(config)).toMatchObject({
      binding: 'CF_VERSION_METADATA',
    });
    expect(() =>
      validateQualificationWorkerConfig(
        JSON.stringify({ ...JSON.parse(config), main: 'src/version-b.ts' }),
        'src/version-a.ts'
      )
    ).toThrow('entrypoint');
    for (const extra of [
      { route: 'edge-evidence.ogabassey.com/*' },
      { routes: ['edge-evidence.ogabassey.com/*'] },
      { vars: { OTHER: 'value' } },
      { r2_buckets: [] },
      { secrets: ['SECRET'] },
    ])
      expect(() =>
        validateQualificationWorkerConfig(
          JSON.stringify({ ...JSON.parse(config), ...extra })
        )
      ).toThrow('forbidden');
    expect(() =>
      validateQualificationWorkerConfig(
        JSON.stringify({
          ...JSON.parse(config),
          version_metadata: {
            binding: 'CF_VERSION_METADATA',
            extra_binding: 'NOT_ALLOWED',
          },
        })
      )
    ).toThrow('exactly one');
  });
  it('hashes canonical config with locale-independent Unicode code-unit ordering', () => {
    const first = `{
      "version_metadata": { "binding": "CF_VERSION_METADATA" },
      "main": "src/version-a.ts",
      "name": "baci-evidence-qualification-\u00e9",
      "compatibility_date": "2026-07-31"
    }`;
    const reordered = `{
      "compatibility_date": "2026-07-31",
      "name": "baci-evidence-qualification-\u00e9",
      "main": "src/version-a.ts",
      "version_metadata": { "binding": "CF_VERSION_METADATA" }
    }`;
    const expected = validateQualificationWorkerConfig(
      first,
      'src/version-a.ts'
    ).canonicalSha256;
    const localeCompare = vi
      .spyOn(String.prototype, 'localeCompare')
      .mockReturnValue(1);
    expect(
      validateQualificationWorkerConfig(reordered, 'src/version-a.ts')
        .canonicalSha256
    ).toBe(expected);
    localeCompare.mockRestore();
  });
});
