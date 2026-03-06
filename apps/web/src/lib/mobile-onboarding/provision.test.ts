import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(),
  })),
}));

import type { MobileOnboardingProfile } from './metadata';
import { provisionMobileOnboarding } from './provision';

interface HarnessOptions {
  existingMerchant?: Record<string, unknown> | null;
  merchantWriteResult?: {
    data: { id: string; slug: string | null } | null;
    error: { code?: string; message?: string } | null;
  };
  domainError?: { code?: string; message?: string } | null;
  existingStaff?: { id: string } | null;
  staffLookupError?: { message?: string } | null;
  staffUpsertError?: { message?: string } | null;
  staffUpdateError?: { message?: string } | null;
}

function createHarness(options: HarnessOptions = {}) {
  const merchantLookupMaybeSingle = vi.fn().mockResolvedValue({
    data: options.existingMerchant ?? null,
    error: null,
  });
  const merchantWriteSingle = vi.fn().mockResolvedValue(
    options.merchantWriteResult ?? {
      data: { id: 'merch-1', slug: 'test-store' },
      error: null,
    }
  );
  const domainInsert = vi.fn().mockResolvedValue({
    data: null,
    error: options.domainError ?? null,
  });
  const staffLookupMaybeSingle = vi.fn().mockResolvedValue({
    data: options.existingStaff ?? null,
    error: options.staffLookupError ?? null,
  });
  const staffUpsert = vi
    .fn()
    .mockResolvedValue({ data: null, error: options.staffUpsertError ?? null });
  const staffUpdateEq = vi
    .fn()
    .mockResolvedValue({ data: null, error: options.staffUpdateError ?? null });

  const merchantsSelectChain = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: merchantLookupMaybeSingle,
  };
  const merchantsInsertSelectChain = {
    single: merchantWriteSingle,
  };
  const merchantsInsertChain = {
    select: vi.fn(() => merchantsInsertSelectChain),
  };
  const merchantsUpdateSelectChain = {
    single: merchantWriteSingle,
  };
  const merchantsUpdateEqChain = {
    select: vi.fn(() => merchantsUpdateSelectChain),
  };
  const merchantsQuery = {
    select: vi.fn(() => merchantsSelectChain),
    insert: vi.fn(() => merchantsInsertChain),
    update: vi.fn(() => ({
      eq: vi.fn(() => merchantsUpdateEqChain),
    })),
  };

  const staffSelectChain = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: staffLookupMaybeSingle,
  };
  const staffUpdateChain = {
    eq: staffUpdateEq,
  };
  const staffQuery = {
    select: vi.fn(() => staffSelectChain),
    upsert: staffUpsert,
    update: vi.fn(() => staffUpdateChain),
  };

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'merchants') {
        return merchantsQuery;
      }
      if (table === 'domains') {
        return { insert: domainInsert };
      }
      if (table === 'staff_members') {
        return staffQuery;
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  } as unknown as SupabaseClient;

  return {
    supabase,
    merchantsQuery,
    domainInsert,
    staffUpsert,
    staffUpdateEq,
    merchantLookupMaybeSingle,
    merchantWriteSingle,
  };
}

const profile: MobileOnboardingProfile = {
  email: 'merchant@example.com',
  fullName: 'John Doe',
  firstName: 'John',
  lastName: 'Doe',
  businessName: 'Test Store',
  businessType: 'fashion',
  otherBusinessType: null,
  phone: null,
  slug: 'test-store',
  logoUrl: 'https://cdn.usebaci.com/logo.png',
  brandColors: {
    primary: '#000000',
    background: '#ffffff',
    accent: '#F59E0B',
  },
};

describe('provisionMobileOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provisions a new merchant, domain, and owner staff member', async () => {
    const harness = createHarness();

    const result = await provisionMobileOnboarding({
      supabase: harness.supabase,
      user: { id: 'user-1', email: 'merchant@example.com' },
      profile,
      rootDomain: 'usebaci.com',
    });

    expect(result).toEqual({
      success: true,
      merchant: { id: 'merch-1', slug: 'test-store' },
      user: { id: 'user-1', email: 'merchant@example.com' },
      message: 'Account created successfully',
    });
    expect(harness.merchantsQuery.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      email: 'merchant@example.com',
      business_name: 'Test Store',
      business_type: 'fashion',
      logo_url: 'https://cdn.usebaci.com/logo.png',
      favicon_png_192_url: 'https://cdn.usebaci.com/logo.png',
      brand_colors: {
        primary: '#000000',
        background: '#ffffff',
        accent: '#F59E0B',
      },
      slug: 'test-store',
      template_id: 'puck',
    });
    expect(harness.domainInsert).toHaveBeenCalledWith({
      merchant_id: 'merch-1',
      domain: 'test-store.usebaci.com',
      tld: '.usebaci.com',
      domain_type: 'subdomain',
      status: 'active',
      is_primary: true,
    });
    expect(harness.staffUpsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        merchant_id: 'merch-1',
        name: 'John Doe',
        email: 'merchant@example.com',
        role: 'admin',
        status: 'active',
        accepted_at: expect.any(String),
      },
      { onConflict: 'merchant_id,email' }
    );
  });

  it('ignores duplicate domain errors', async () => {
    const harness = createHarness({
      domainError: { code: '23505', message: 'duplicate key value' },
    });

    const result = await provisionMobileOnboarding({
      supabase: harness.supabase,
      user: { id: 'user-1', email: 'merchant@example.com' },
      profile,
      rootDomain: 'usebaci.com',
    });

    expect(result.success).toBe(true);
  });

  it('returns a slug-unavailable response when the merchant write conflicts', async () => {
    const harness = createHarness({
      merchantWriteResult: {
        data: null,
        error: { code: '23505', message: 'duplicate key value' },
      },
    });

    const result = await provisionMobileOnboarding({
      supabase: harness.supabase,
      user: { id: 'user-1', email: 'merchant@example.com' },
      profile,
      rootDomain: 'usebaci.com',
    });

    expect(result).toEqual({
      success: false,
      status: 422,
      body: {
        error:
          'Store link is already in use. Please complete your profile to choose another one.',
        code: 'SLUG_UNAVAILABLE',
      },
    });
  });

  it('updates an existing merchant and owner staff record during reprovisioning', async () => {
    const harness = createHarness({
      existingMerchant: {
        id: 'merch-1',
        slug: 'existing-store',
        business_name: 'Existing Store',
        business_type: 'fashion',
        logo_url: 'https://cdn.usebaci.com/existing.png',
        favicon_png_192_url: 'https://cdn.usebaci.com/existing.png',
        brand_colors: {
          primary: '#111111',
          background: '#ffffff',
          accent: '#222222',
        },
        template_id: 'puck',
      },
      existingStaff: { id: 'staff-1' },
      merchantWriteResult: {
        data: { id: 'merch-1', slug: 'existing-store' },
        error: null,
      },
    });

    const result = await provisionMobileOnboarding({
      supabase: harness.supabase,
      user: { id: 'user-1', email: 'merchant@example.com' },
      profile,
      rootDomain: 'usebaci.com',
    });

    expect(result).toEqual({
      success: true,
      merchant: { id: 'merch-1', slug: 'existing-store' },
      user: { id: 'user-1', email: 'merchant@example.com' },
      message: 'Account created successfully',
    });
    expect(harness.merchantsQuery.insert).not.toHaveBeenCalled();
    expect(harness.merchantsQuery.update).toHaveBeenCalledTimes(1);
    expect(harness.staffUpsert).not.toHaveBeenCalled();
    expect(harness.staffUpdateEq).toHaveBeenCalledTimes(1);
  });

  it('throws when the owner email is missing', async () => {
    const harness = createHarness();

    await expect(
      provisionMobileOnboarding({
        supabase: harness.supabase,
        user: { id: 'user-1', email: undefined },
        profile,
        rootDomain: 'usebaci.com',
      })
    ).rejects.toThrow('Owner account is missing an email address.');
  });
});
