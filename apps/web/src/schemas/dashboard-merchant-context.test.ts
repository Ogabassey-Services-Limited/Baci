import { describe, expect, it } from 'vitest';
import { dashboardMerchantContextSchema } from './dashboard-merchant-context';

describe('dashboardMerchantContextSchema', () => {
  it('accepts an owner dashboard context', () => {
    const result = dashboardMerchantContextSchema.safeParse({
      merchant: { id: 'merchant-1', business_name: 'Baci Store' },
      primaryDomain: { id: 'domain-1', domain: 'shop.example.com' },
      staffAccess: {
        isStaff: false,
        isOwner: true,
        role: null,
        permissions: { full_access: { all: true } },
      },
    });

    expect(result.success).toBe(true);
  });

  it('accepts a null primary domain', () => {
    const result = dashboardMerchantContextSchema.safeParse({
      merchant: { id: 'merchant-1' },
      primaryDomain: null,
      staffAccess: {
        isStaff: true,
        isOwner: false,
        role: 'manager',
        permissions: { settings: { view: true } },
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects malformed permission values', () => {
    const result = dashboardMerchantContextSchema.safeParse({
      merchant: { id: 'merchant-1' },
      primaryDomain: null,
      staffAccess: {
        isStaff: true,
        isOwner: false,
        role: 'manager',
        permissions: { settings: { view: 'yes' } },
      },
    });

    expect(result.success).toBe(false);
  });
});
