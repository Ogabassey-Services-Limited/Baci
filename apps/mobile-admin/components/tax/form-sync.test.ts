import { describe, expect, it } from 'vitest';
import {
  buildAddressSyncSignature,
  buildMerchantAddressSyncState,
  buildTaxSyncSignature,
} from './form-sync';

describe('form-sync', () => {
  it('builds a stable address signature', () => {
    expect(
      buildAddressSyncSignature({
        merchantId: 'merchant-1',
        street: '12 Allen Avenue',
        city: 'Lagos',
        postalCode: '100001',
        stateCode: 'LA',
      })
    ).toBe('merchant-1|12 Allen Avenue|Lagos|100001|LA');
  });

  it('prefers the explicit merchant state code when available', () => {
    expect(
      buildMerchantAddressSyncState({
        merchantId: 'merchant-1',
        merchantAddress: {
          street: '12 Allen Avenue',
          city: 'Lagos',
          state: 'Ogun',
          postal_code: '100001',
          country: 'Nigeria',
        },
        merchantStateCode: 'LA',
      })
    ).toEqual({
      mappedStateCode: 'LA',
      signature: 'merchant-1|12 Allen Avenue|Lagos|100001|LA',
    });
  });

  it('falls back to matching the registered address state name', () => {
    expect(
      buildMerchantAddressSyncState({
        merchantId: 'merchant-1',
        merchantAddress: {
          street: '12 Allen Avenue',
          city: 'Lagos',
          state: 'lagos',
          postal_code: '100001',
          country: 'Nigeria',
        },
        merchantStateCode: '',
      })
    ).toEqual({
      mappedStateCode: 'NG-LA',
      signature: 'merchant-1|12 Allen Avenue|Lagos|100001|NG-LA',
    });
  });

  it('returns an empty state code when there is no registered address', () => {
    expect(
      buildMerchantAddressSyncState({
        merchantId: 'merchant-1',
        merchantAddress: null,
        merchantStateCode: '',
      })
    ).toEqual({
      mappedStateCode: '',
      signature: 'merchant-1||||',
    });
  });

  it('keeps an empty state code when the address state does not match', () => {
    expect(
      buildMerchantAddressSyncState({
        merchantId: 'merchant-1',
        merchantAddress: {
          street: '12 Allen Avenue',
          city: 'Lagos',
          state: 'InvalidState',
          postal_code: '100001',
          country: 'Nigeria',
        },
        merchantStateCode: '',
      })
    ).toEqual({
      mappedStateCode: '',
      signature: 'merchant-1|12 Allen Avenue|Lagos|100001|',
    });
  });

  it('builds the tax signature from merchant fields', () => {
    expect(
      buildTaxSyncSignature({
        merchantId: 'merchant-1',
        vatRegistrationStatus: 'registered',
        taxIdentificationNumber: '1234567890',
        legalEntityName: 'Baci Foods Ltd',
      })
    ).toBe('merchant-1|registered|1234567890|Baci Foods Ltd');
  });
});
