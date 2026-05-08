import { describe, expect, it } from 'vitest';
import { buildSocialItems } from './receipt-social';

describe('buildSocialItems', () => {
  it('returns no items for empty social settings', () => {
    expect(buildSocialItems({})).toEqual([]);
    expect(buildSocialItems(null)).toEqual([]);
  });

  it('normalizes common social URLs without path or query fragments', () => {
    const items = buildSocialItems({
      instagram: 'https://www.instagram.com/ogabasseyy?igsh=abc',
      facebook: 'https://www.facebook.com/mystore?mibextid=abc',
      twitter: 'https://x.com/bacisupport?s=20',
    }).join('');

    expect(items).toContain('@ogabasseyy');
    expect(items).toContain('@mystore');
    expect(items).toContain('@bacisupport');
    expect(items).not.toContain('igsh');
    expect(items).not.toContain('mibextid');
    expect(items).not.toContain('?s=');
  });

  it('normalizes mobile social subdomain URLs into handles', () => {
    const items = buildSocialItems({
      facebook: 'm.facebook.com/ogabasseyy?mibextid=abc',
      twitter: 'mobile.twitter.com/bacisupport?s=20',
    }).join('');

    expect(items).toContain('@ogabasseyy');
    expect(items).toContain('@bacisupport');
    expect(items).not.toContain('@m.facebook.com');
    expect(items).not.toContain('@mobile.twitter.com');
  });

  it('ignores social redirect subdomains instead of rendering route names', () => {
    const items = buildSocialItems({
      facebook:
        'https://l.facebook.com/l.php?u=https%3A%2F%2Ffacebook.com%2Fogabasseyy',
    }).join('');

    expect(items).toBe('');
    expect(items).not.toContain('@l.php');
  });

  it('ignores URLs from the wrong social host', () => {
    const items = buildSocialItems({
      instagram: 'https://facebook.com/ogabasseyy',
    });

    expect(items).toEqual([]);
  });

  it('normalizes Facebook pages category URLs to the page handle', () => {
    const [facebookItem] = buildSocialItems({
      facebook:
        'https://www.facebook.com/pages/category/Shopping-Retail/Ogabassey-Store/1234567890?mibextid=ZbWKwL',
    });

    expect(facebookItem).toBeDefined();
    expect(facebookItem).toContain('@ogabassey-store');
    expect(facebookItem).not.toContain('category');
    expect(facebookItem).not.toContain('shopping-retail');
    expect(facebookItem).not.toContain('1234567890');
    expect(facebookItem).not.toContain('mibextid');
  });

  it('normalizes Facebook pg URLs to the page handle', () => {
    const [facebookItem] = buildSocialItems({
      facebook: 'https://www.facebook.com/pg/Ogabassey-Store/about/?ref=page',
    });

    expect(facebookItem).toBeDefined();
    expect(facebookItem).toContain('@ogabassey-store');
    expect(facebookItem).not.toContain('@pg');
    expect(facebookItem).not.toContain('about');
  });
});
