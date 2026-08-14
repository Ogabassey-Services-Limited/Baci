import { describe, expect, it } from 'vitest';
import { generateProductSchema } from './seo-utils';
import { makeSeoProduct } from './seo-utils-product-schema-test-helper';

describe('generateProductSchema content and custom properties', () => {
  it('uses the enriched product description instead of a generic meta description', () => {
    const schema = generateProductSchema(
      makeSeoProduct({
        category: 'Cameras',
        description:
          '<p>Canon EOS R5 Mark II has a 45MP stacked full-frame sensor and 8K RAW video.</p>',
        meta_description:
          'Shop Canon EOS R5 Mark II Mirrorless Camera Body in Nigeria.',
      }),
      'Ogabassey',
      'NGN',
      'NG'
    );

    expect(schema.description).toContain('45MP stacked full-frame sensor');
    expect(schema.description).not.toBe(
      'Shop Canon EOS R5 Mark II Mirrorless Camera Body in Nigeria.'
    );
  });

  it('falls back to meta description after visible description sanitizes empty', () => {
    const schema = generateProductSchema(
      makeSeoProduct({
        description: '<p></p>',
        meta_description: 'Canon EOS R5 mirrorless camera with 45MP imaging.',
      }),
      'Ogabassey',
      'NGN',
      'NG'
    );

    expect(schema.description).toBe(
      'Canon EOS R5 mirrorless camera with 45MP imaging.'
    );
  });

  it('filters stored additional properties through the current product taxonomy', () => {
    const schema = generateProductSchema(
      makeSeoProduct({
        category: 'Cameras',
        schema_markup: {
          '@context': 'https://schema.org',
          '@type': 'Product',
          additionalProperty: [
            { '@type': 'PropertyValue', name: '5G Support', value: 'No' },
            {
              '@type': 'PropertyValue',
              name: 'Network Technology',
              value: 'N/A',
            },
            { '@type': 'PropertyValue', name: 'Selfie Camera', value: '0MP' },
            { '@type': 'PropertyValue', name: 'Sensor', value: '45MP CMOS' },
          ],
        },
      }),
      'Ogabassey',
      'NGN',
      'NG'
    );

    expect(schema.additionalProperty).toEqual(
      expect.arrayContaining([
        { '@type': 'PropertyValue', name: 'Sensor', value: '45MP CMOS' },
      ])
    );
    expect(schema.additionalProperty).not.toEqual(
      expect.arrayContaining([
        { '@type': 'PropertyValue', name: '5G Support', value: 'No' },
        {
          '@type': 'PropertyValue',
          name: 'Network Technology',
          value: 'N/A',
        },
        { '@type': 'PropertyValue', name: 'Selfie Camera', value: '0MP' },
      ])
    );
  });

  it('preserves singleton custom PropertyValue metadata without overriding live description', () => {
    const schema = generateProductSchema(
      makeSeoProduct({
        category: 'Cameras',
        description: 'Enriched camera description with current product facts.',
        schema_markup: {
          '@context': 'https://schema.org',
          '@type': 'Product',
          description: 'Old persisted description that must not win.',
          additionalProperty: {
            '@type': 'PropertyValue',
            name: 'Focal Length',
            value: {
              '@type': 'QuantitativeValue',
              value: 24,
              unitCode: 'MMT',
            },
            propertyID: 'camera-focal-length',
            unitCode: 'MMT',
          },
        },
      }),
      'Ogabassey',
      'NGN',
      'NG'
    );

    expect(schema.description).toBe(
      'Enriched camera description with current product facts.'
    );
    expect(schema.additionalProperty).toEqual(
      expect.arrayContaining([
        {
          '@type': 'PropertyValue',
          name: 'Focal Length',
          value: {
            '@type': 'QuantitativeValue',
            value: 24,
            unitCode: 'MMT',
          },
          propertyID: 'camera-focal-length',
          unitCode: 'MMT',
        },
      ])
    );
  });

  it('preserves range-only custom PropertyValue schema markup', () => {
    const schema = generateProductSchema(
      makeSeoProduct({
        category: 'Cameras',
        schema_markup: {
          '@context': 'https://schema.org',
          '@type': 'Product',
          additionalProperty: {
            '@type': 'PropertyValue',
            name: 'Operating Temperature',
            minValue: -10,
            maxValue: 45,
            unitCode: 'CEL',
          },
        },
      }),
      'Ogabassey',
      'NGN',
      'NG'
    );

    expect(schema.additionalProperty).toEqual(
      expect.arrayContaining([
        {
          '@type': 'PropertyValue',
          name: 'Operating Temperature',
          minValue: -10,
          maxValue: 45,
          unitCode: 'CEL',
        },
      ])
    );
  });

  it('keeps a valid positive endpoint in a zero-based custom range', () => {
    const schema = generateProductSchema(
      makeSeoProduct({
        category: 'Cameras',
        schema_markup: {
          '@context': 'https://schema.org',
          '@type': 'Product',
          additionalProperty: {
            '@type': 'PropertyValue',
            name: 'Peak Brightness',
            minValue: 0,
            maxValue: 1000,
            unitCode: 'NTR',
          },
        },
      }),
      'Ogabassey',
      'NGN',
      'NG'
    );

    expect(schema.additionalProperty).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Peak Brightness',
          minValue: 0,
          maxValue: 1000,
        }),
      ])
    );
  });

  it('rejects propertyID-only phone specs from accessory product schema markup', () => {
    const schema = generateProductSchema(
      makeSeoProduct({
        category: 'Phone Cases',
        schema_markup: {
          '@context': 'https://schema.org',
          '@type': 'Product',
          additionalProperty: {
            '@type': 'PropertyValue',
            propertyID: 'ram_gb',
            value: '16GB',
          },
        },
      }),
      'Ogabassey',
      'NGN',
      'NG'
    );

    expect(schema.additionalProperty).toBeUndefined();
  });

  it('rejects propertyID-only capability specs from accessory product schema markup', () => {
    const schema = generateProductSchema(
      makeSeoProduct({
        category: 'Phone Cases',
        schema_markup: {
          '@context': 'https://schema.org',
          '@type': 'Product',
          additionalProperty: {
            '@type': 'PropertyValue',
            propertyID: 'has_5g',
            value: true,
          },
        },
      }),
      'Ogabassey',
      'NGN',
      'NG'
    );

    expect(schema.additionalProperty).toBeUndefined();
  });

  it('preserves one-sided custom PropertyValue ranges in product schema markup', () => {
    const schema = generateProductSchema(
      makeSeoProduct({
        category: 'Cameras',
        schema_markup: {
          '@context': 'https://schema.org',
          '@type': 'Product',
          additionalProperty: {
            '@type': 'PropertyValue',
            name: 'Maximum operating temperature',
            maxValue: 45,
            unitCode: 'CEL',
          },
        },
      }),
      'Ogabassey',
      'NGN',
      'NG'
    );

    expect(schema.additionalProperty).toEqual(
      expect.arrayContaining([
        {
          '@type': 'PropertyValue',
          name: 'Maximum operating temperature',
          maxValue: 45,
          unitCode: 'CEL',
        },
      ])
    );
  });
});
