import { describe, expect, it } from 'vitest';
import { buildOgabasseyProductVisibleSummary } from './build-product-visible-summary';

describe('buildOgabasseyProductVisibleSummary', () => {
  it('builds a parent-only summary from identity and condition without reading marketing copy', () => {
    const summary = buildOgabasseyProductVisibleSummary({
      brand: 'Samsung',
      condition: 'new',
      name: 'Galaxy S25',
      variants: [],
      ...( {
        description:
          '<p>Long marketing copy that must never appear in the summary.</p>',
      } as object),
    });

    expect(summary).toBe('Samsung Galaxy S25. Condition: New.');
    expect(summary).not.toContain('Long marketing copy');
  });

  it('includes structured facts only when every selectable variant shares them', () => {
    expect(
      buildOgabasseyProductVisibleSummary({
        brand: 'Apple',
        name: 'iPhone 16 Pro',
        variants: [
          {
            attributes: {
              colour: 'space black',
              connectivity: '5g',
              ram: '8GB',
              storage: '256gb',
            },
            condition: 'new',
          },
          {
            attributes: {
              color: 'Space Black',
              connectivity: '5G',
              ram: '8 GB',
              storage: '256 GB',
            },
            condition: 'new',
          },
        ],
      })
    ).toBe(
      'Apple iPhone 16 Pro. Storage: 256 GB. RAM: 8 GB. Connectivity: 5G. Colour: Space Black. Condition: New.'
    );
  });

  it('uses exhaustive priority-ordered choices and caps varying axes at three', () => {
    expect(
      buildOgabasseyProductVisibleSummary({
        brand: 'Samsung',
        name: 'Galaxy S24',
        variants: [
          {
            attributes: {
              colour: 'blue',
              connectivity: '5g',
              ram: '12 GB',
              storage: '256 GB',
            },
            condition: 'new',
          },
          {
            attributes: {
              colour: 'black',
              connectivity: '4g',
              ram: '12GB',
              storage: '128GB',
            },
            condition: 'used',
          },
        ],
      })
    ).toBe(
      'Samsung Galaxy S24. RAM: 12 GB. Available choices: Storage 128 GB or 256 GB. Connectivity 4G or 5G. Colour Black or Blue.'
    );
  });

  it('omits incomplete and alias-ambiguous axes instead of claiming a partial fact', () => {
    expect(
      buildOgabasseyProductVisibleSummary({
        brand: 'Google',
        name: 'Pixel 10',
        variants: [
          {
            attributes: { color: 'Black', colour: 'Blue', storage: '128 GB' },
            condition: 'new',
          },
          {
            attributes: { color: 'Black', storage: '' },
            condition: 'new',
          },
        ],
      })
    ).toBe('Google Pixel 10. Condition: New.');
  });

  it('ignores inactive variants and remains independent of selected-offer state', () => {
    const input = {
      brand: 'OnePlus',
      name: '13',
      variants: [
        {
          attributes: { storage: '512 GB' },
          condition: 'used',
          status: 'inactive',
        },
        {
          attributes: { storage: '256 GB' },
          condition: 'new',
        },
      ],
    };

    const firstSummary = buildOgabasseyProductVisibleSummary(input);
    const afterSelectionSummary = buildOgabasseyProductVisibleSummary({
      ...input,
      selectedVariantId: 'not-consumed',
    } as typeof input);

    expect(firstSummary).toBe('OnePlus 13. Storage: 256 GB. Condition: New.');
    expect(afterSelectionSummary).toBe(firstSummary);
  });

  it('uses only the active parent when no selectable variants exist', () => {
    expect(
      buildOgabasseyProductVisibleSummary({
        brand: 'Dell',
        condition: 'used',
        name: 'Latitude 7440',
        ...( {
          offers: [
            { condition: 'new', status: 'active' },
            { condition: 'refurbished', status: 'inactive' },
          ],
        } as object),
      })
    ).toBe('Dell Latitude 7440. Condition: Used.');
  });

  it('falls back to the active parent when every supplied variant is not selectable', () => {
    expect(
      buildOgabasseyProductVisibleSummary({
        brand: 'Dell',
        condition: 'new',
        name: 'Latitude 7450',
        variants: [
          { condition: 'used', status: 'inactive' },
          { condition: 'refurbished', deleted_at: '2026-01-01' },
        ],
      })
    ).toBe('Dell Latitude 7450. Condition: New.');
  });

  it('omits the summary when identity or all safe facts are absent', () => {
    expect(
      buildOgabasseyProductVisibleSummary({
        condition: 'new',
        name: 'Unnamed brand product',
      })
    ).toBeNull();
    expect(
      buildOgabasseyProductVisibleSummary({
        brand: 'Sony',
        name: 'Xperia',
        variants: [{ attributes: {}, condition: '' }],
      })
    ).toBeNull();
  });
  it('uses the parent condition when selectable variants omit their own condition', () => {
    expect(
      buildOgabasseyProductVisibleSummary({
        brand: 'Dell',
        condition: 'new',
        name: 'XPS 13',
        variants: [
          { attributes: { storage: '512 GB' } },
          { attributes: { storage: '512GB' } },
        ],
      })
    ).toBe('Dell XPS 13. Storage: 512 GB. Condition: New.');
  });

  it('includes the parent condition with active condition offers', () => {
    const summary = buildOgabasseyProductVisibleSummary({
      brand: 'HP',
      condition: 'new',
      conditionOffers: [
        { condition: 'used', attributes: {} },
        { condition: 'open_box', attributes: {} },
      ],
      name: 'EliteBook 640 G11',
    });

    expect(summary).toBe(
      'HP EliteBook 640 G11. Available choices: Condition New or Open Box or Used.'
    );
  });

  it('does not add a stale parent condition to SKU-matrix variants', () => {
    expect(
      buildOgabasseyProductVisibleSummary({
        brand: 'Dell',
        condition: 'new',
        name: 'Latitude 7450',
        variants: [
          { condition: 'used', attributes: { storage: '512 GB' } },
        ],
      })
    ).toBe('Dell Latitude 7450. Storage: 512 GB. Condition: Used.');
  });

  it('does not replace the selector condition fallback with a variant attribute', () => {
    expect(
      buildOgabasseyProductVisibleSummary({
        brand: 'Dell',
        condition: 'new',
        name: 'XPS 13',
        variants: [
          {
            attributes: { condition: 'used', storage: '512 GB' },
            condition: null,
          },
        ],
      })
    ).toBe('Dell XPS 13. Storage: 512 GB. Condition: New.');
  });

  it('rejects condition facts when normalized condition aliases conflict', () => {
    expect(
      buildOgabasseyProductVisibleSummary({
        brand: 'Dell',
        name: 'XPS 13',
        variants: [
          {
            attributes: { Condition: 'new', condition: 'used' },
            condition: 'new',
          },
        ],
      })
    ).toBeNull();
  });

});
