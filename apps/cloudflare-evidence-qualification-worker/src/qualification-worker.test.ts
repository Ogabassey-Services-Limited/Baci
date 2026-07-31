import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import versionA from './version-a';
import versionB from './version-b';
import { buildQualificationArtifactReceipt } from './qualification-artifact-receipt';

const root = resolve(import.meta.dirname, '..');
describe('cloudflare evidence qualification worker fixture', () => {
  it('produces distinct deterministic 204 artifact receipts and metadata headers', async () => {
    const [responseA, responseB] = await Promise.all([
      versionA.fetch(new Request('https://edge-evidence.ogabassey.com'), {
        CF_VERSION_METADATA: { id: 'provider-a' },
      } as Env),
      versionB.fetch(new Request('https://edge-evidence.ogabassey.com'), {
        CF_VERSION_METADATA: { id: 'provider-b' },
      } as Env),
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
  it('runs both injected dry-run artifacts and seals deterministic unequal receipts', async () => {
    const calls: string[] = [];
    const runner = {
      dryRun: async (configPath: string, outputDirectory: string) => {
        calls.push(`${configPath}:${outputDirectory}`);
        const version = configPath.includes('version-a') ? 'a' : 'b';
        return {
          bundle: new TextEncoder().encode(`bundle-${version}`),
          moduleList: [`version-${version}.js`],
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
});
