import { describe, expect, it } from 'vitest';
import { modelFamilyAuthorityTaxonomy } from '@/lib/storefront-category/model-family-authority-taxonomy';

describe('model family authority taxonomy', () => {
  it('resolves curated family routes only', () => {
    expect(
      modelFamilyAuthorityTaxonomy.getEntry(
        'smartphones',
        'samsung',
        'galaxy-s'
      )
    ).toMatchObject({ displayName: 'Samsung Galaxy S', minimumProducts: 3 });
    expect(
      modelFamilyAuthorityTaxonomy.getEntry('laptops', 'samsung', 'galaxy-s')
    ).toBeNull();
  });

  it('matches distinct Xiaomi and Redmi families without overlap', () => {
    const entries = modelFamilyAuthorityTaxonomy.getEntries(
      'smartphones',
      'xiaomi'
    );
    const matchingKeys = (name: string) =>
      entries
        .filter((entry) =>
          modelFamilyAuthorityTaxonomy.matchesProduct(entry, name)
        )
        .map((entry) => entry.familyKey);

    expect(matchingKeys('Redmi Note 15 Pro')).toEqual(['redmi-note']);
    expect(matchingKeys('Redmi A7 Pro')).toEqual(['redmi-a']);
    expect(matchingKeys('Redmi 15C 5G')).toEqual(['redmi-15']);
    expect(matchingKeys('Xiaomi 17T Pro')).toEqual(['xiaomi-t']);
  });

  it('matches case-insensitive family names', () => {
    const entry = modelFamilyAuthorityTaxonomy.getEntry(
      'smartphones',
      'tecno',
      'pop'
    );
    if (!entry) throw new Error('Expected Tecno Pop family entry');
    expect(
      modelFamilyAuthorityTaxonomy.matchesProduct(entry, 'Tecno POP 10 Pro')
    ).toBe(true);
  });

  it('matches family names when the product name omits its separate brand', () => {
    const entry = modelFamilyAuthorityTaxonomy.getEntry(
      'smartphones',
      'samsung',
      'galaxy-s'
    );
    if (!entry) throw new Error('Expected Samsung Galaxy S family entry');

    expect(
      modelFamilyAuthorityTaxonomy.matchesProduct(entry, 'Galaxy S24 Ultra')
    ).toBe(true);
  });
});
