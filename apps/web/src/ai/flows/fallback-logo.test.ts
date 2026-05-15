import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { createFallbackLogo } from './fallback-logo';

const DATA_URI_PREFIX = 'data:image/svg+xml;base64,';

function decodeLogoSvg(logoDataUri: string) {
  expect(logoDataUri.startsWith(DATA_URI_PREFIX)).toBe(true);
  return Buffer.from(
    logoDataUri.slice(DATA_URI_PREFIX.length),
    'base64'
  ).toString('utf8');
}

describe('createFallbackLogo', () => {
  it('creates a safe SVG data URI with industry colors', () => {
    const result = createFallbackLogo('Baci <Food>', 'food-beverage');
    const svg = decodeLogoSvg(result.logoDataUri);

    expect(result.brandColors).toEqual({
      primary: '#15803D',
      background: '#FFF7ED',
      accent: '#F97316',
    });
    expect(svg).toContain('Baci &lt;Food&gt; logo');
    expect(svg).not.toContain('Baci <Food>');
  });

  it('falls back to the default display name for empty or nullable names', () => {
    expect(
      decodeLogoSvg(createFallbackLogo('', 'fashion').logoDataUri)
    ).toContain('Baci Store logo');
    expect(
      decodeLogoSvg(
        createFallbackLogo(null as unknown as string, 'fashion').logoDataUri
      )
    ).toContain('Baci Store logo');
    expect(
      decodeLogoSvg(
        createFallbackLogo(undefined as unknown as string, 'fashion')
          .logoDataUri
      )
    ).toContain('Baci Store logo');
  });

  it('escapes special characters in labels and initials', () => {
    const svg = decodeLogoSvg(
      createFallbackLogo('A&B <C> "D"', 'pharmaceuticals').logoDataUri
    );

    expect(svg).toContain('A&amp;B &lt;C&gt; &quot;D&quot; logo');
    expect(svg).toContain('>A&lt;<');
    expect(svg).not.toContain('A&B <C> "D" logo');
  });

  it('uses known industry palettes and defaults unknown industries safely', () => {
    expect(
      createFallbackLogo('Gadget Shop', 'electronics').brandColors
    ).toEqual({
      primary: '#2563EB',
      background: '#EFF6FF',
      accent: '#06B6D4',
    });
    expect(
      createFallbackLogo('Unknown Shop', 'unknown-industry').brandColors
    ).toEqual({
      primary: '#BE123C',
      background: '#FFF1F2',
      accent: '#F59E0B',
    });
    expect(
      createFallbackLogo('Null Industry', null as unknown as string).brandColors
    ).toEqual({
      primary: '#BE123C',
      background: '#FFF1F2',
      accent: '#F59E0B',
    });
  });

  it('handles very long brand names without breaking the SVG', () => {
    const displayName = 'A'.repeat(200);
    const svg = decodeLogoSvg(
      createFallbackLogo(displayName, 'handmade').logoDataUri
    );

    expect(svg).toContain(`${displayName} logo`);
    expect(svg).toContain('>A<');
  });
});
