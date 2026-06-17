import { describe, expect, it } from 'vitest';
import { COUNTRIES } from '@/constants/countries';
import type { Merchant } from '@/hooks/useMerchant';
import {
  buildBaselineFromMerchant,
  buildInitialFormValues,
  buildMerchantUpdatePayload,
  type StoreSettingsFormValues,
} from './store-settings-payload';

const DEFAULT_COUNTRY = COUNTRIES[0];

const baselineForm: StoreSettingsFormValues = {
  business_name: 'Baci Foods',
  phone: '+2348012345678',
  support_phone: '+2347000000000',
  support_email: 'support@usebaci.com',
  business_address: '12 Allen Avenue',
  country: 'NG',
  payout_currency: 'NGN',
  slug: 'baci-foods',
};

function makeMerchant(overrides: Partial<Merchant> = {}): Merchant {
  return {
    id: 'merchant-1',
    business_name: 'Baci Foods',
    phone: '+2348012345678',
    support_phone: '+2347000000000',
    support_email: 'support@usebaci.com',
    business_address: '12 Allen Avenue',
    country: 'NG',
    payout_currency: 'NGN',
    slug: 'baci-foods',
    email: 'owner@usebaci.com',
    updated_at: '2026-06-17T08:00:00.000Z',
    ...overrides,
  } as Merchant;
}

describe('store settings payload helpers', () => {
  it('returns only the changed column when a single field is edited', () => {
    expect(
      buildMerchantUpdatePayload(baselineForm, {
        ...baselineForm,
        business_name: 'Baci Foods Ltd',
      })
    ).toEqual({ business_name: 'Baci Foods Ltd' });
  });

  it('preserves phone and support_phone as separate columns', () => {
    const payload = buildMerchantUpdatePayload(baselineForm, {
      ...baselineForm,
      support_phone: '+2349999999999',
    });

    expect(payload).toEqual({ support_phone: '+2349999999999' });
    expect(payload).not.toHaveProperty('phone');
  });

  it('copies a newly entered primary phone into support_phone when no public contact exists', () => {
    expect(
      buildMerchantUpdatePayload(
        { ...baselineForm, phone: '', support_email: '', support_phone: '' },
        {
          ...baselineForm,
          phone: '+2340000000001',
          support_email: '',
          support_phone: '',
        }
      )
    ).toEqual({
      phone: '+2340000000001',
      support_phone: '+2340000000001',
    });
  });

  it('baselines nullable columns to empty strings, not UI fallbacks', () => {
    const baseline = buildBaselineFromMerchant(
      makeMerchant({ country: null, payout_currency: null })
    );

    expect(baseline.country).toBe('');
    expect(baseline.payout_currency).toBe('');
  });

  it('applies country picker defaults only to display values', () => {
    const form = buildInitialFormValues(
      makeMerchant({ country: null, payout_currency: null })
    );

    expect(form.country).toBe(DEFAULT_COUNTRY.code);
    expect(form.currency).toBe(DEFAULT_COUNTRY.currency);
  });

  it('does not use auth email as an editable support email fallback', () => {
    expect(
      buildInitialFormValues(
        makeMerchant({ email: 'owner@usebaci.com', support_email: null })
      ).email
    ).toBe('');
  });
});
