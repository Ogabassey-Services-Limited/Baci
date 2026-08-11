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

  it('keeps explicit computer audio negatives without accepting camera capability negatives', () => {
    expect(
      getProductSchemaSpecValueDecision({
        canonicalSpecKey: 'has_headphone_jack',
        hasCategory: true,
        isMobileCategory: false,
        isPhoneOnlyLabel: true,
        normalizedLabel: 'headphone jack',
        productFamily: 'computer',
        value: false,
      })
    ).toBe('include');
    expect(
      getProductSchemaSpecValueDecision({
        canonicalSpecKey: 'has_ois',
        hasCategory: true,
        isMobileCategory: false,
        isPhoneOnlyLabel: true,
        normalizedLabel: 'ois',
        productFamily: 'camera',
        value: false,
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

  it('rejects truthy strings for boolean capabilities instead of treating them as verified', () => {
    for (const value of ['Yes', 'Unknown', 'Not specified']) {
      expect(
        getProductSchemaSpecValueDecision({
          canonicalSpecKey: 'has_nfc',
          hasCategory: true,
          isMobileCategory: true,
          isPhoneOnlyLabel: true,
          normalizedLabel: 'nfc',
          productFamily: 'mobile',
          value,
        })
      ).toBe('exclude');
    }
  });

  it('keeps a supported card-slot type as a factual specification', () => {
    expect(
      getProductSchemaSpecValueDecision({
        canonicalSpecKey: 'card_slot_type',
        hasCategory: true,
        isMobileCategory: false,
        isPhoneOnlyLabel: true,
        normalizedLabel: 'card slot',
        productFamily: 'camera',
        value: 'CFexpress Type B / SD UHS-II',
      })
    ).toBe('defer');
  });
});
