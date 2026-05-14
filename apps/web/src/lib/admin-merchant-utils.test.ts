import { describe, expect, it } from 'vitest';
import {
  ADMIN_MERCHANT_SURFACE_LABELS,
  ADMIN_MERCHANT_SURFACES,
  formatAdminMerchantDate,
  formatAdminMerchantEnumLabel,
  getAdminMerchantSurfaceVariant,
} from '@/lib/admin-merchant-utils';

describe('admin merchant utilities', () => {
  it('formats nullable merchant user dates', () => {
    expect(formatAdminMerchantDate(null)).toBe('Never');
    expect(formatAdminMerchantDate('not-a-date')).toBe('Never');
    const expectedDate = new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date('2026-03-24T10:00:00.000Z'));

    expect(formatAdminMerchantDate('2026-03-24T10:00:00.000Z')).toBe(
      expectedDate
    );
  });

  it('maps merchant surfaces to badge labels and variants', () => {
    expect(ADMIN_MERCHANT_SURFACE_LABELS[ADMIN_MERCHANT_SURFACES.WEB]).toBe(
      'Web'
    );
    expect(
      ADMIN_MERCHANT_SURFACE_LABELS[ADMIN_MERCHANT_SURFACES.ADMIN_APP]
    ).toBe('Admin app');
    expect(
      ADMIN_MERCHANT_SURFACE_LABELS[ADMIN_MERCHANT_SURFACES.STOREFRONT_APP]
    ).toBe('Storefront app');
    expect(getAdminMerchantSurfaceVariant(ADMIN_MERCHANT_SURFACES.WEB)).toBe(
      'outline'
    );
    expect(
      getAdminMerchantSurfaceVariant(ADMIN_MERCHANT_SURFACES.ADMIN_APP)
    ).toBe('default');
    expect(
      getAdminMerchantSurfaceVariant(ADMIN_MERCHANT_SURFACES.STOREFRONT_APP)
    ).toBe('secondary');
  });

  it('falls back to the outline variant for unknown surface keys', () => {
    expect(getAdminMerchantSurfaceVariant('unknown_surface' as never)).toBe(
      'outline'
    );
  });

  it('formats enum labels for display', () => {
    expect(formatAdminMerchantEnumLabel('app_user')).toBe('App User');
    expect(formatAdminMerchantEnumLabel('')).toBe('');
    expect(formatAdminMerchantEnumLabel('app__user')).toBe('App User');
    expect(formatAdminMerchantEnumLabel('appuser')).toBe('Appuser');
    expect(formatAdminMerchantEnumLabel('_app_user_')).toBe('App User');
  });
});
