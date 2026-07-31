import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
describe('cloudflare evidence qualification worker fixture', () => {
  it('pins Wrangler and isolates two unequal metadata-only bundles', async () => {
    const [pkg, configA, configB, sourceA, sourceB] = await Promise.all(
      [
        'package.json',
        'wrangler.version-a.jsonc',
        'wrangler.version-b.jsonc',
        'src/version-a.ts',
        'src/version-b.ts',
      ].map((file) => readFile(resolve(root, file), 'utf8'))
    );
    expect(pkg).toContain('"wrangler": "4.115.0"');
    expect(configA).toContain('"binding": "CF_VERSION_METADATA"');
    expect(configB).toContain('"binding": "CF_VERSION_METADATA"');
    expect(sourceA).not.toBe(sourceB);
    expect(`${configA}${configB}${sourceA}${sourceB}`).not.toMatch(
      /route|secret|await\s+fetch\(|globalThis\.fetch\(|storefront-edge|@baci\//i
    );
    expect(`${sourceA}${sourceB}`).not.toContain('CF_VERSION_METADATA: {');
  });
});
