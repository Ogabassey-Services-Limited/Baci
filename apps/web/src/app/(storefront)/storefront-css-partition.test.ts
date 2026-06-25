import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const storefrontDir = dirname(fileURLToPath(import.meta.url));

function readStorefrontFile(fileName: string): string {
  const filePath = join(storefrontDir, fileName);

  if (!existsSync(filePath)) {
    throw new Error(
      `Missing storefront fixture ${fileName} in ${storefrontDir}. Run from the @baci/web test environment.`
    );
  }

  return readFileSync(filePath, 'utf8');
}

describe('storefront CSS partitioning', () => {
  it('throws a clear error when a CSS fixture is missing', () => {
    expect(() => readStorefrontFile('nonexistent.css')).toThrow(
      `Missing storefront fixture nonexistent.css in ${storefrontDir}. Run from the @baci/web test environment.`
    );
  });

  it('keeps PDP-only selectors out of the shared storefront core stylesheet', () => {
    const coreCss = readStorefrontFile('storefront-core.css');

    expect(coreCss).not.toMatch(/data-ogabassey-pdp/);
    expect(coreCss).not.toMatch(/\.ogabassey-pdp-/);
  });

  it('keeps the broad PDP entrypoint focused on default product-detail utilities', () => {
    const pdpCss = readStorefrontFile('storefront-pdp.css');

    expect(pdpCss).not.toMatch(/storefront-core\.css/);
    expect(pdpCss).not.toMatch(/storefront-pdp-critical\.css/);
    expect(pdpCss).not.toMatch(/storefront-pdp-semantic\.css/);
    expect(pdpCss).not.toMatch(/storefront-pdp-tabs\.css/);
    expect(pdpCss).not.toMatch(/storefront-pdp-reviews\.css/);
    expect(pdpCss).toMatch(
      /@source\s+["'][^"']*products\/\[productSlug\]\/product-detail-client\.tsx/
    );
    expect(pdpCss).not.toMatch(
      /@source\s+["'][^"']*ogabassey\/pdp\/critical-shell\.tsx/
    );
    expect(pdpCss).not.toMatch(
      /@source\s+["'][^"']*product-details-page\/deferred-product-details-sections\.tsx/
    );
  });

  it('loads OgaBassey below-fold PDP styles through the deferred PDP stylesheet', () => {
    const deferredPdpCss = readStorefrontFile(
      'storefront-ogabassey-pdp-deferred.css'
    );

    expect(deferredPdpCss).toMatch(
      /@import\s+['"]\.\/storefront-pdp-semantic\.css['"];?/
    );
    expect(deferredPdpCss).toMatch(
      /@import\s+['"]\.\/storefront-pdp-tabs\.css['"];?/
    );
    expect(deferredPdpCss).toMatch(
      /@import\s+['"]\.\/storefront-pdp-reviews\.css['"];?/
    );
  });

  it('validates OgaBassey category PDP route imports critical CSS in page, PDP CSS in renderer, and excludes PDP CSS from client', () => {
    const categoryPdpPage = readStorefrontFile(
      '[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.tsx'
    );
    const defaultRenderer = readStorefrontFile(
      '[slug]/(catalog)/(pdp)/[category]/[productSlug]/default-product-page-renderer.tsx'
    );
    const defaultDetailClient = readStorefrontFile(
      '[slug]/(catalog)/(pdp)/[category]/[productSlug]/default-product-detail-client.tsx'
    );

    expect(categoryPdpPage).toMatch(
      /import\s+['"]@\/app\/\(storefront\)\/storefront-pdp-critical\.css['"];?/
    );
    expect(defaultRenderer).toMatch(
      /import\s+['"]@\/app\/\(storefront\)\/storefront-pdp\.css['"];?/
    );
    expect(defaultDetailClient).not.toMatch(/storefront-pdp\.css/);
  });

  it('keeps server-rendered hero utilities in the homepage critical CSS', () => {
    const homeCriticalCss = readStorefrontFile('storefront-home-critical.css');

    expect(homeCriticalCss).toMatch(
      /@source\s+["'][^"']*components\/Hero\.tsx["']/
    );
    expect(homeCriticalCss).toMatch(
      /@source\s+["'][^"']*hero-mobile-carousel\.tsx["']/
    );
    expect(homeCriticalCss).toMatch(
      /@source\s+["'][^"']*hero-desktop-grid\.tsx["']/
    );
    expect(homeCriticalCss).toMatch(
      /@source\s+["'][^"']*ogabassey-home-hero-fallback\.tsx["']/
    );
  });

  it('registers store color tokens in the render-blocking critical CSS so the hero paints styled on first frame', () => {
    // Regression guard: the store-* colors are only registered via the shared
    // @theme inline token block. If the home critical CSS does not import it, the
    // critical layer cannot generate `.bg-store-secondary` et al. and the hero
    // first-paints unstyled (dark shell shows through) until the deferred CSS.
    const homeCriticalCss = readStorefrontFile('storefront-home-critical.css');
    expect(homeCriticalCss).toMatch(
      /@import\s+["']\.\/storefront-theme-tokens\.css["']/
    );

    const tokens = readStorefrontFile('storefront-theme-tokens.css');
    // Tokens must use @theme inline + literal hex fallbacks so utilities emit a
    // paintable color even before the per-merchant --store-* vars resolve.
    expect(tokens).toMatch(/@theme inline/);
    expect(tokens).toMatch(
      /--color-store-secondary:\s*var\(--store-secondary,\s*#f3f4f6\)/
    );
  });

  it('keeps homepage product-card utilities deferred while retaining critical grid geometry selectors', () => {
    const homeCriticalCss = readStorefrontFile('storefront-home-critical.css');
    const homeCss = readStorefrontFile('storefront-home.css');

    expect(homeCriticalCss).not.toMatch(/storefront-foundation\.css/);
    expect(homeCriticalCss).not.toMatch(
      /@source\s+["'][^"']*HomeProductGrid\.tsx/
    );
    expect(homeCriticalCss).not.toMatch(
      /@source\s+["'][^"']*HomeProductGridCard\.tsx/
    );
    expect(homeCriticalCss).not.toMatch(
      /@source\s+["'][^"']*ProductRatingRow\.tsx/
    );
    expect(homeCriticalCss).toMatch(/\.ogabassey-home-products\b/);
    expect(homeCriticalCss).toMatch(/\.ogabassey-home-products__grid\b/);
    expect(homeCriticalCss).toMatch(/\.ogabassey-home-products__empty\b/);
    expect(homeCriticalCss).toMatch(/\.ogabassey-home-product-card\b/);
    expect(homeCriticalCss).toMatch(/\.ogabassey-home-product-card__media\b/);
    expect(homeCriticalCss).toMatch(
      /\.ogabassey-home-product-card__condition--open-box\b/
    );
    expect(homeCriticalCss).not.toMatch(/animation:\s*pulse/);
    expect(homeCriticalCss).not.toMatch(/@keyframes\s+pulse/);

    expect(homeCss).toMatch(/@source\s+["'][^"']*HomeProductGrid\.tsx/);
    expect(homeCss).toMatch(/@source\s+["'][^"']*HomeProductGridCard\.tsx/);
    expect(homeCss).toMatch(/@source\s+["'][^"']*ProductRatingRow\.tsx/);
  });

  it('keeps deferred assistant launcher selectors out of the PPR shell critical stylesheet', () => {
    const coreCss = readStorefrontFile('storefront-core.css');

    expect(coreCss).toMatch(/\.storefront-shell-loading/);
    expect(coreCss).toMatch(/\.storefront-ppr-static-shell/);
    expect(coreCss).toMatch(/\.ogabassey-navbar/);
    expect(coreCss).toMatch(/\.ogabassey-mobile-footer/);
    expect(coreCss).not.toMatch(/\.ogabassey-chat-/);
  });

  it('keeps OgaBassey footer contrast styles in the shared core stylesheet', () => {
    const coreCss = readStorefrontFile('storefront-core.css');

    expect(coreCss).toMatch(/\.ogabassey-footer\b/);
    expect(coreCss).toMatch(
      /background:\s*color-mix\(\s*in srgb,\s*var\(--store-background-text,\s*#111827\)\s*94%,\s*black\s*\)/
    );
    expect(coreCss).toMatch(/color:\s*var\(--store-background,\s*#ffffff\)/);
  });

  it('loads deferred assistant launcher styles through the assistant chunk stylesheet', () => {
    const chatCss = readStorefrontFile('storefront-chat.css');

    expect(chatCss).toMatch(/\.ogabassey-chat-anchor/);
    expect(chatCss).toMatch(/\.ogabassey-chat-button/);
    expect(chatCss).toMatch(/\.ogabassey-chat-badge/);
  });
});
