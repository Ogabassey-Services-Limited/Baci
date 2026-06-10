import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const storefrontDir = dirname(fileURLToPath(import.meta.url));

function readStorefrontCss(fileName: string): string {
  const filePath = join(storefrontDir, fileName);

  if (!existsSync(filePath)) {
    throw new Error(
      `Missing storefront CSS fixture ${fileName} in ${storefrontDir}. Run from the @baci/web test environment.`
    );
  }

  return readFileSync(filePath, 'utf8');
}

describe('storefront CSS partitioning', () => {
  it('throws a clear error when a CSS fixture is missing', () => {
    expect(() => readStorefrontCss('nonexistent.css')).toThrow(
      `Missing storefront CSS fixture nonexistent.css in ${storefrontDir}. Run from the @baci/web test environment.`
    );
  });

  it('keeps PDP-only selectors out of the shared storefront core stylesheet', () => {
    const coreCss = readStorefrontCss('storefront-core.css');

    expect(coreCss).not.toMatch(/data-ogabassey-pdp/);
    expect(coreCss).not.toMatch(/\.ogabassey-pdp-/);
  });

  it('loads PDP-specific styles only through the PDP entrypoint', () => {
    const pdpCss = readStorefrontCss('storefront-pdp.css');

    expect(pdpCss).toMatch(
      /@import\s+['"]\.\/storefront-pdp-critical\.css['"];?/
    );
    expect(pdpCss).toMatch(
      /@import\s+['"]\.\/storefront-pdp-semantic\.css['"];?/
    );
    expect(pdpCss).toMatch(/@import\s+['"]\.\/storefront-pdp-tabs\.css['"];?/);
    expect(pdpCss).toMatch(
      /@import\s+['"]\.\/storefront-pdp-reviews\.css['"];?/
    );
  });
});
