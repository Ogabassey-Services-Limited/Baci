import { describe, expect, it } from 'vitest';
import {
  buildProductDetailXml,
  type FeedKeySpecs,
  hasGmcVariantAxis,
  mapVariantToGmcAttributes,
} from './variant-mapping';

describe('mapVariantToGmcAttributes', () => {
  it('maps color and storage to GMC fields', () => {
    expect(
      mapVariantToGmcAttributes({ color: 'Blue', storage: '128GB' })
    ).toEqual({ color: 'Blue', size: '128GB' });
  });

  it('maps storage only (no color)', () => {
    expect(mapVariantToGmcAttributes({ storage: '256GB' })).toEqual({
      size: '256GB',
    });
  });

  it('maps color only (no storage)', () => {
    expect(mapVariantToGmcAttributes({ color: 'Black' })).toEqual({
      color: 'Black',
    });
  });

  it('maps mixed-case keys to GMC fields', () => {
    expect(
      mapVariantToGmcAttributes({ Color: 'Blue', Storage: '128GB' })
    ).toEqual({ color: 'Blue', size: '128GB' });
  });

  it('returns empty for non-GMC attributes only', () => {
    expect(
      mapVariantToGmcAttributes({ ram: '12GB', sim_type: 'eSIM' })
    ).toEqual({});
  });

  it('concatenates storage and size when both exist', () => {
    expect(
      mapVariantToGmcAttributes({ storage: '512GB', size: '10.1 inch' })
    ).toEqual({ size: '512GB / 10.1 inch' });
  });

  it('passes through multi-color names', () => {
    expect(
      mapVariantToGmcAttributes({ color: 'Titanium Blue / Gold' })
    ).toEqual({ color: 'Titanium Blue / Gold' });
  });

  it('returns empty for empty attributes', () => {
    expect(mapVariantToGmcAttributes({})).toEqual({});
  });

  it('trims whitespace from values', () => {
    expect(
      mapVariantToGmcAttributes({ color: '  Blue  ', storage: ' 128GB ' })
    ).toEqual({ color: 'Blue', size: '128GB' });
  });

  it('ignores empty string values', () => {
    expect(mapVariantToGmcAttributes({ color: '', storage: '' })).toEqual({});
  });

  it('coerces primitive JSONB values to strings and ignores non-scalars', () => {
    expect(
      mapVariantToGmcAttributes({
        color: '  Blue  ',
        storage: 256,
        size: 10.1,
        extras: { nested: true },
      })
    ).toEqual({ color: 'Blue', size: '256 / 10.1' });
  });
});

describe('hasGmcVariantAxis', () => {
  it('returns true when color is present', () => {
    expect(hasGmcVariantAxis({ color: 'Blue' })).toBe(true);
  });

  it('returns true when storage is present', () => {
    expect(hasGmcVariantAxis({ storage: '128GB' })).toBe(true);
  });

  it('returns false when only non-GMC attributes exist', () => {
    expect(hasGmcVariantAxis({ ram: '12GB', sim_type: 'eSIM' })).toBe(false);
  });

  it('returns true for mixed-case GMC axis keys', () => {
    expect(hasGmcVariantAxis({ Color: 'Blue' })).toBe(true);
  });

  it('returns true for mixed-case storage axis keys', () => {
    expect(hasGmcVariantAxis({ Storage: '128GB' })).toBe(true);
  });

  it('returns false for empty attributes', () => {
    expect(hasGmcVariantAxis({})).toBe(false);
  });
});

describe('buildProductDetailXml', () => {
  it('emits product_detail entries for all key_specs', () => {
    const specs: FeedKeySpecs = {
      ram_gb: 12,
      storage_gb: 256,
      screen_size_inches: 6.78,
      chipset: 'Dimensity 8350',
      battery_mah: 5000,
      main_camera_mp: 108,
    };
    const xml = buildProductDetailXml(specs);

    expect(xml).toContain('<g:attribute_name>RAM</g:attribute_name>');
    expect(xml).toContain('<g:attribute_value>12GB</g:attribute_value>');
    expect(xml).toContain(
      '<g:attribute_name>Storage Capacity</g:attribute_name>'
    );
    expect(xml).toContain('<g:attribute_value>256GB</g:attribute_value>');
    expect(xml).toContain('<g:attribute_name>Screen Size</g:attribute_name>');
    expect(xml).toContain('<g:attribute_value>6.78 inches</g:attribute_value>');
    expect(xml).toContain('<g:attribute_name>Processor</g:attribute_name>');
    expect(xml).toContain(
      '<g:attribute_value>Dimensity 8350</g:attribute_value>'
    );
    expect(xml).toContain('<g:attribute_name>Battery</g:attribute_name>');
    expect(xml).toContain('<g:attribute_value>5000 mAh</g:attribute_value>');
    expect(xml).toContain('<g:attribute_name>Main Camera</g:attribute_name>');
    expect(xml).toContain('<g:attribute_value>108 MP</g:attribute_value>');
  });

  it('returns empty string when no specs are provided', () => {
    expect(buildProductDetailXml({})).toBe('');
  });

  it('skips null/undefined spec values', () => {
    const specs: FeedKeySpecs = { ram_gb: 8 };
    const xml = buildProductDetailXml(specs);

    expect(xml).toContain('<g:attribute_name>RAM</g:attribute_name>');
    expect(xml).not.toContain('Storage');
    expect(xml).not.toContain('Screen Size');
  });

  it('escapes XML special characters in chipset values', () => {
    const specs: FeedKeySpecs = {
      chipset: 'Snapdragon 8 Gen 3 & Adreno <750>',
    };
    const xml = buildProductDetailXml(specs);

    expect(xml).toContain(
      '<g:attribute_value>Snapdragon 8 Gen 3 &amp; Adreno &lt;750&gt;</g:attribute_value>'
    );
    expect(xml).not.toContain('& Adreno <750>');
  });
});
