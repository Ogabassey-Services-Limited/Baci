import { describe, expect, it } from 'vitest';
import { OGABASSEY_INTERNAL_LINK_EQUITY_GROUPS } from './ogabassey-internal-link-equity';

// The config entries are hand-typed 'slug|label' / 'href|label' strings, so a
// missing or extra delimiter silently produces an empty slug, empty label, or
// truncated label. These checks catch malformed entries at test time.
describe('OGABASSEY_INTERNAL_LINK_EQUITY_GROUPS', () => {
  const allLinks = OGABASSEY_INTERNAL_LINK_EQUITY_GROUPS.flatMap(
    (group) => group.links
  );
  const allProductLinks = OGABASSEY_INTERNAL_LINK_EQUITY_GROUPS.flatMap(
    (group) => group.productLinks
  );

  it('parses every product entry into a non-empty slug and label', () => {
    for (const productLink of allProductLinks) {
      expect(productLink.productSlug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(productLink.label.trim()).not.toBe('');
      // a '|' surviving into either field means a malformed source entry
      expect(productLink.productSlug).not.toContain('|');
      expect(productLink.label).not.toContain('|');
    }
  });

  it('parses every literal entry into a rooted href and non-empty label', () => {
    for (const link of allLinks) {
      expect(link.href).toMatch(/^\//);
      expect(link.label.trim()).not.toBe('');
      expect(link.href).not.toContain('|');
      expect(link.label).not.toContain('|');
    }
  });

  it('never repeats a product slug or literal href across groups', () => {
    const productSlugs = allProductLinks.map((link) => link.productSlug);
    const hrefs = allLinks.map((link) => link.href);

    expect(new Set(productSlugs).size).toBe(productSlugs.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('keeps every group non-empty and described', () => {
    for (const group of OGABASSEY_INTERNAL_LINK_EQUITY_GROUPS) {
      expect(group.title.trim()).not.toBe('');
      expect(group.description.trim()).not.toBe('');
      expect(group.links.length + group.productLinks.length).toBeGreaterThan(0);
    }
  });
});
