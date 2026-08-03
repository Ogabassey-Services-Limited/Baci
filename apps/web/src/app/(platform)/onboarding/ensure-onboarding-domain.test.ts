import { describe, expect, it, vi } from 'vitest';
import { ensureOnboardingDomain } from './ensure-onboarding-domain';

function createClient() {
  const maybeSingle = vi.fn();
  const eqDomain = vi.fn(() => ({ maybeSingle }));
  const eqMerchant = vi.fn(() => ({ eq: eqDomain }));
  const select = vi.fn((columns: string) =>
    columns === 'merchant_id' ? { eq: eqDomain } : { eq: eqMerchant }
  );
  const insert = vi.fn();
  const from = vi.fn(() => ({ select, insert }));
  return { from, select, insert, maybeSingle, eqMerchant, eqDomain };
}

const input = {
  merchantId: 'merchant-1',
  slug: 'analytical-engines',
  rootDomain: 'usebaci.com',
};

describe('ensureOnboardingDomain', () => {
  it('returns already_exists for the exact owner platform domain without writing', async () => {
    const supabase = createClient();
    supabase.maybeSingle.mockResolvedValue({
      data: { merchant_id: 'merchant-1' },
      error: null,
    });

    await expect(
      ensureOnboardingDomain({ ...input, supabase })
    ).resolves.toEqual({ status: 'already_exists' });
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it('inserts the missing domain as primary only when the merchant has no primary domain', async () => {
    const supabase = createClient();
    supabase.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    supabase.insert.mockResolvedValue({ error: null });

    await expect(
      ensureOnboardingDomain({ ...input, supabase })
    ).resolves.toEqual({ status: 'created' });
    expect(supabase.insert).toHaveBeenCalledWith({
      merchant_id: 'merchant-1',
      domain: 'analytical-engines.usebaci.com',
      tld: '.usebaci.com',
      domain_type: 'subdomain',
      status: 'active',
      is_primary: true,
    });
  });

  it('preserves an existing custom primary while inserting the recovery subdomain non-primary', async () => {
    const supabase = createClient();
    supabase.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: 'custom-primary' }, error: null });
    supabase.insert.mockResolvedValue({ error: null });

    await expect(
      ensureOnboardingDomain({ ...input, supabase })
    ).resolves.toEqual({ status: 'created' });
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ is_primary: false })
    );
  });

  it('accepts a 23505 only after the RLS-scoped reread returns the exact owner row', async () => {
    const supabase = createClient();
    supabase.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: { merchant_id: 'merchant-1' },
        error: null,
      });
    supabase.insert.mockResolvedValue({ error: { code: '23505' } });

    await expect(
      ensureOnboardingDomain({ ...input, supabase })
    ).resolves.toEqual({ status: 'already_exists' });
  });

  it('returns conflict when a conflicting domain is hidden by RLS and never takes ownership', async () => {
    const supabase = createClient();
    supabase.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    supabase.insert.mockResolvedValue({ error: { code: '23505' } });

    await expect(
      ensureOnboardingDomain({ ...input, supabase })
    ).resolves.toEqual({ status: 'conflict' });
    expect(supabase.insert).toHaveBeenCalledOnce();
  });
});
