import { describe, expect, it } from 'vitest';
import { getProductSchemaSpecValueDecision } from './product-schema-spec-value-policy';

describe('getProductSchemaSpecValueDecision', () => {
  it('excludes missing and invalid measurement values for every family', () => {
    for (const value of [undefined, null, 0, 'N/A', '0GB']) {
      expect(
        getProductSchemaSpecValueDecision({
          canonicalSpecKey: 'storage_gb',
          hasCategory: true,
          isMobileCategory: true,
          isPhoneOnlyLabel: false,
          normalizedLabel: 'storage',
          value,
        })
      ).toBe('exclude');
    }
  });

  it('includes explicit negative capabilities only for mobile families', () => {
    const input = {
      canonicalSpecKey: 'has_5g',
      hasCategory: true,
      isPhoneOnlyLabel: true,
      normalizedLabel: '5g support',
      value: false,
    };

    expect(
      getProductSchemaSpecValueDecision({
        ...input,
        isMobileCategory: true,
      })
    ).toBe('include');
    expect(
      getProductSchemaSpecValueDecision({
        ...input,
        isMobileCategory: false,
      })
    ).toBe('exclude');
  });

  it('defers meaningful unrelated negative facts to category policy', () => {
    expect(
      getProductSchemaSpecValueDecision({
        hasCategory: true,
        isMobileCategory: false,
        isPhoneOnlyLabel: false,
        normalizedLabel: 'weather sealing',
        value: 'No',
      })
    ).toBe('defer');
  });
});
