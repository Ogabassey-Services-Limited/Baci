import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ generateInitialTemplate: vi.fn() }));

vi.mock('@/lib/initial-template-generator', () => ({
  generateInitialTemplate: mocks.generateInitialTemplate,
}));

import { provisionCuratedHomepage } from './provision-curated-homepage';

const input = {
  expectedOwnerUserId: 'user-1',
  merchantId: 'merchant-1',
  merchantSlug: 'analytical-engines',
  businessName: 'Analytical Engines',
  businessType: 'technology',
  brandColors: { primary: '#111111', background: '#ffffff', accent: '#f59e0b' },
};

function createClient() {
  const maybeSingle = vi.fn();
  const eqSlug = vi.fn(() => ({ maybeSingle }));
  const eqMerchant = vi.fn(() => ({ eq: eqSlug }));
  const select = vi.fn(() => ({ eq: eqMerchant }));
  const insertSelect = vi.fn(() => ({ maybeSingle }));
  const insert = vi.fn(() => ({ select: insertSelect }));
  const from = vi.fn(() => ({ insert, select }));
  return {
    auth: { getUser: vi.fn() },
    from,
    insert,
    insertSelect,
    maybeSingle,
    select,
    eqMerchant,
    eqSlug,
  };
}

describe('provisionCuratedHomepage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateInitialTemplate.mockResolvedValue({ content: [], theme: {} });
  });

  it('authenticates the expected owner before template construction or writes', async () => {
    const client = createClient();
    client.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(
      provisionCuratedHomepage({ ...input, supabase: client })
    ).resolves.toEqual({
      status: 'failed',
      stage: 'auth',
    });
    expect(mocks.generateInitialTemplate).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it('rejects a changed authenticated user before template construction or writes', async () => {
    const client = createClient();
    client.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-2' } },
      error: null,
    });

    await expect(
      provisionCuratedHomepage({ ...input, supabase: client })
    ).resolves.toEqual({
      status: 'failed',
      stage: 'auth',
    });
    expect(mocks.generateInitialTemplate).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it('inserts one deterministic published home config with an explicit projection', async () => {
    const client = createClient();
    client.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    client.maybeSingle.mockResolvedValue({
      data: { updated_at: '2026-08-02T00:00:00Z' },
      error: null,
    });

    await expect(
      provisionCuratedHomepage({ ...input, supabase: client })
    ).resolves.toEqual({
      status: 'created',
      updatedAt: '2026-08-02T00:00:00Z',
    });
    expect(client.from).toHaveBeenCalledWith('page_configs');
    expect(client.insert).toHaveBeenCalledWith({
      merchant_id: 'merchant-1',
      page_slug: 'home',
      page_name: 'Home',
      draft_config: { content: [], theme: {} },
      published_config: { content: [], theme: {} },
      is_published: true,
    });
    expect(client.insertSelect).toHaveBeenCalledWith('updated_at');
    expect(mocks.generateInitialTemplate).toHaveBeenCalledWith({
      businessName: 'Analytical Engines',
      businessType: 'technology',
      brandColors: input.brandColors,
      merchant: { id: 'merchant-1', slug: 'analytical-engines' },
    });
  });

  it('treats 23505 as idempotent only after finding the exact existing home', async () => {
    const client = createClient();
    client.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    client.maybeSingle
      .mockResolvedValueOnce({ data: null, error: { code: '23505' } })
      .mockResolvedValueOnce({
        data: { updated_at: '2026-08-01T00:00:00Z' },
        error: null,
      });

    await expect(
      provisionCuratedHomepage({ ...input, supabase: client })
    ).resolves.toEqual({
      status: 'already_exists',
      updatedAt: '2026-08-01T00:00:00Z',
    });
    expect(client.select).toHaveBeenCalledWith('updated_at');
    expect(client.eqMerchant).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(client.eqSlug).toHaveBeenCalledWith('page_slug', 'home');
  });

  it('fails safely when a conflict cannot be reread through tenant RLS', async () => {
    const client = createClient();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    client.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    client.maybeSingle
      .mockResolvedValueOnce({ data: null, error: { code: '23505' } })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(
      provisionCuratedHomepage({ ...input, supabase: client })
    ).resolves.toEqual({
      status: 'failed',
      stage: 'read_after_conflict',
    });
    expect(errorSpy).toHaveBeenCalledWith('curated-homepage-provisioning', {
      merchantId: 'merchant-1',
      stage: 'read_after_conflict',
      pgCode: null,
    });
    errorSpy.mockRestore();
  });

  it('reports only merchant ID, stage, and PostgreSQL code when insert fails', async () => {
    const client = createClient();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    client.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    client.maybeSingle.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'secret=never-log' },
    });

    await expect(
      provisionCuratedHomepage({ ...input, supabase: client })
    ).resolves.toEqual({ status: 'failed', stage: 'insert' });
    expect(errorSpy).toHaveBeenCalledWith('curated-homepage-provisioning', {
      merchantId: 'merchant-1',
      stage: 'insert',
      pgCode: '42501',
    });
    errorSpy.mockRestore();
  });

  it('never enqueues AI work or calls an AI provider', async () => {
    const client = createClient();
    client.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    client.maybeSingle.mockResolvedValue({
      data: { updated_at: null },
      error: null,
    });

    await provisionCuratedHomepage({ ...input, supabase: client });

    expect(client.from).not.toHaveBeenCalledWith('ai_jobs');
    expect(mocks.generateInitialTemplate).toHaveBeenCalledOnce();
  });
});
