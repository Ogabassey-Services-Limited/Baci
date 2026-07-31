import { describe, expect, it } from 'vitest';
import { COUNTRIES } from '@/constants/countries';
import type { Merchant } from '@/hooks/useMerchant';
import {
  buildBaselineFromMerchant,
  buildInitialFormValues,
  buildMerchantUpdatePayload,
  hasNonEmptyTrimmedValue,
  rebaseStoreSettingsBaseline,
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
  it('detects non-empty trimmed values consistently', () => {
    expect(hasNonEmptyTrimmedValue(' baci-foods ')).toBe(true);
    expect(hasNonEmptyTrimmedValue('   ')).toBe(false);
    expect(hasNonEmptyTrimmedValue(null)).toBe(false);
    expect(hasNonEmptyTrimmedValue(undefined)).toBe(false);
  });

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

  it('does not submit slug changes for established store URLs', () => {
    const nextForm = {
      ...baselineForm,
      business_name: 'Baci Foods Ltd',
      slug: 'baci-foods-ltd',
    };

    const payload = buildMerchantUpdatePayload(baselineForm, nextForm);

    expect(payload).toEqual({ business_name: 'Baci Foods Ltd' });
  });

  it('allows a slug to be set when the merchant does not have one yet', () => {
    const unlockedBaseline = { ...baselineForm, slug: '' };
    const nextForm = {
      ...baselineForm,
      slug: 'baci-foods',
    };

    const payload = buildMerchantUpdatePayload(unlockedBaseline, nextForm);

    expect(payload).toEqual({ slug: 'baci-foods' });
  });

  it('allows a slug to be set when the baseline slug is whitespace only', () => {
    const unlockedBaseline = { ...baselineForm, slug: '   ' };
    const nextForm = {
      ...baselineForm,
      slug: 'baci-foods',
    };

    const payload = buildMerchantUpdatePayload(unlockedBaseline, nextForm);

    expect(payload).toEqual({ slug: 'baci-foods' });
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

  it('does not copy primary phone when support email is provided', () => {
    expect(
      buildMerchantUpdatePayload(
        { ...baselineForm, phone: '', support_email: '', support_phone: '' },
        {
          ...baselineForm,
          phone: '+2340000000001',
          support_email: 'support@usebaci.com',
          support_phone: '',
        }
      )
    ).toEqual({
      phone: '+2340000000001',
      support_email: 'support@usebaci.com',
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

  it('prefills an empty support email with the merchant auth email', () => {
    expect(
      buildInitialFormValues(
        makeMerchant({ email: 'owner@usebaci.com', support_email: null })
      ).email
    ).toBe('owner@usebaci.com');
  });

  it('does not persist an auth-email prefill when an unrelated field is saved', () => {
    const merchant = makeMerchant({
      email: 'owner@usebaci.com',
      support_email: null,
    });
    const baseline = buildBaselineFromMerchant(merchant);

    expect(
      buildMerchantUpdatePayload(baseline, {
        ...baseline,
        business_name: 'Baci Foods Ltd',
        support_email: 'owner@usebaci.com',
      })
    ).toEqual({ business_name: 'Baci Foods Ltd' });
  });

  it('preserves an unchanged auth-email prefill after saving another field', () => {
    const baseline = buildBaselineFromMerchant(
      makeMerchant({ email: 'owner@usebaci.com', support_email: null })
    );

    expect(
      rebaseStoreSettingsBaseline({
        authEmailPrefill: 'owner@usebaci.com',
        baseline,
        displayedSupportEmail: 'owner@usebaci.com',
        savedValues: {
          ...baseline,
          business_name: 'Baci Foods Ltd',
          support_email: '',
        },
      })
    ).toMatchObject({
      business_name: 'Baci Foods Ltd',
      support_email: 'owner@usebaci.com',
    });
  });

  it('clears an edited auth-email prefill after the server saves it blank', () => {
    const baseline = buildBaselineFromMerchant(
      makeMerchant({ email: 'owner@usebaci.com', support_email: null })
    );

    expect(
      rebaseStoreSettingsBaseline({
        authEmailPrefill: 'owner@usebaci.com',
        baseline,
        displayedSupportEmail: '',
        savedValues: { ...baseline, support_email: '' },
      }).support_email
    ).toBe('');
  });

  it('merges saved server values over the existing baseline', () => {
    const savedValues = {
      ...baselineForm,
      business_name: 'Baci Foods Ltd',
      country: 'GH',
      payout_currency: 'GHS',
      support_email: 'help@usebaci.com',
    };

    expect(
      rebaseStoreSettingsBaseline({
        authEmailPrefill: 'owner@usebaci.com',
        baseline: baselineForm,
        displayedSupportEmail: 'help@usebaci.com',
        savedValues,
      })
    ).toEqual(savedValues);
  });

  it('persists a change made to an auth-email prefill', () => {
    const baseline = buildBaselineFromMerchant(
      makeMerchant({ email: 'owner@usebaci.com', support_email: null })
    );

    expect(
      buildMerchantUpdatePayload(baseline, {
        ...baseline,
        support_email: 'help@usebaci.com',
      })
    ).toEqual({ support_email: 'help@usebaci.com' });
  });

  it('keeps an existing support email instead of replacing it', () => {
    expect(
      buildInitialFormValues(
        makeMerchant({
          email: 'owner@usebaci.com',
          support_email: 'help@usebaci.com',
        })
      ).email
    ).toBe('help@usebaci.com');
  });
});
