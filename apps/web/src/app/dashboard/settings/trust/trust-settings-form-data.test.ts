import { describe, expect, it } from 'vitest';
import {
  buildTrustProfile,
  createTrustFormValues,
  normalizeInteger,
  type TrustFormValues,
} from './trust-settings-form-data';

const emptyValues: TrustFormValues = {
  foundedYear: '',
  handlingDaysMax: '',
  handlingDaysMin: '',
  returnFees: '',
  returnMethod: '',
  returnPolicySummary: '',
  returnWindowDays: '',
  shippingFeeType: '',
  shippingRegions: '',
  shippingSummary: '',
  supportHoursSummary: '',
  supportResponseTimeSummary: '',
  supportTimezone: '',
  transitDaysMax: '',
  transitDaysMin: '',
  warrantySummary: '',
  whatsappNumber: '',
};

describe('buildTrustProfile', () => {
  it('normalizes merchant-entered policy values into the nullable API draft', () => {
    const profile = buildTrustProfile({
      ...emptyValues,
      foundedYear: ' 2018 ',
      handlingDaysMax: ' 2 ',
      handlingDaysMin: '1',
      returnFees: 'customer_pays',
      returnMethod: 'mail',
      shippingFeeType: 'flat_rate',
      shippingRegions: ' NG, GH , , KE ',
      whatsappNumber: ' +234 800 000 0000 ',
    });

    expect(profile).toEqual({
      customer_service: {
        hours_summary: null,
        response_time_summary: null,
        timezone: null,
        whatsapp_number: '+234 800 000 0000',
      },
      founded_year: 2018,
      return_policy: {
        return_fees: 'customer_pays',
        return_method: 'mail',
        summary: null,
        window_days: null,
      },
      shipping_policy: {
        handling_days_max: 2,
        handling_days_min: 1,
        regions: ['NG', 'GH', 'KE'],
        shipping_fee_type: 'flat_rate',
        summary: null,
        transit_days_max: null,
        transit_days_min: null,
      },
      warranty_policy: { summary: null },
    });
  });
});

describe('normalizeInteger', () => {
  it('rejects non-integer drafts instead of silently truncating them', () => {
    expect(normalizeInteger('3.5')).toBeNaN();
    expect(normalizeInteger('two')).toBeNaN();
  });
});

describe('createTrustFormValues', () => {
  it('turns persisted numeric and regional values into editable input values', () => {
    expect(
      createTrustFormValues({
        founded_year: 2020,
        shipping_policy: {
          handling_days_max: 3,
          handling_days_min: 1,
          regions: ['NG', 'GH'],
          shipping_fee_type: 'free',
          summary: 'Ships weekdays',
          transit_days_max: 5,
          transit_days_min: 2,
        },
      })
    ).toMatchObject({
      foundedYear: '2020',
      handlingDaysMax: '3',
      handlingDaysMin: '1',
      shippingRegions: 'NG, GH',
      transitDaysMax: '5',
      transitDaysMin: '2',
    });
  });
});
