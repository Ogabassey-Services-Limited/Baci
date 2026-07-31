import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import versionA from './version-a';
import versionB from './version-b';

const root = resolve(import.meta.dirname, '..');
const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
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
  it('seals unequal config-specific artifacts with the sole generated binding', async () => {
    const [pkg, configA, configB, sourceA, sourceB] = await Promise.all(
      [
        'package.json',
        'wrangler.version-a.jsonc',
        'wrangler.version-b.jsonc',
        'src/version-a.ts',
        'src/version-b.ts',
      ].map((file) => readFile(resolve(root, file), 'utf8'))
    );
    const parsedA = JSON.parse(configA) as {
      version_metadata: { binding: string };
      [key: string]: unknown;
    };
    const parsedB = JSON.parse(configB) as {
      version_metadata: { binding: string };
      [key: string]: unknown;
    };
    expect(pkg).toContain('"wrangler": "4.115.0"');
    expect(Object.keys(parsedA)).toEqual([
      'name',
      'main',
      'compatibility_date',
      'version_metadata',
    ]);
    expect(Object.keys(parsedB)).toEqual([
      'name',
      'main',
      'compatibility_date',
      'version_metadata',
    ]);
    expect(parsedA.version_metadata.binding).toBe('CF_VERSION_METADATA');
    expect(parsedB.version_metadata.binding).toBe('CF_VERSION_METADATA');
    expect(digest(`${configA}\n${sourceA}`)).not.toBe(
      digest(`${configB}\n${sourceB}`)
    );
    expect(`${configA}${configB}${sourceA}${sourceB}`).not.toMatch(
      /route|secret|await\s+fetch\(|globalThis\.fetch\(|storefront-edge|@baci\//i
    );
  });
});
