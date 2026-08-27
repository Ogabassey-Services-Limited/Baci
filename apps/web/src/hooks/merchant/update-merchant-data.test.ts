import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MerchantData, StaffAccess } from './types';
import { createMerchantUpdate } from './update-merchant-data';

const { mockApiPost } = vi.hoisted(() => ({
  mockApiPost: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({ apiPost: mockApiPost }));

const ownerAccess: StaffAccess = {
  isStaff: false,
  isOwner: true,
  role: null,
  permissions: {},
};

const merchant = {
  id: 'merchant-b',
  user_id: 'owner-1',
  business_name: 'Baci B',
  business_type: 'fashion',
} satisfies MerchantData;

function createSupabaseStub() {
  const query = { error: null, eq: vi.fn() };
  query.eq.mockReturnValue(query);
  const update = vi.fn().mockReturnValue(query);
  const from = vi.fn().mockReturnValue({ update });

  return {
    client: {
      from,
    } as unknown as Parameters<typeof createMerchantUpdate>[0]['supabase'],
    from,
    update,
    eq: query.eq,
  };
}

describe('createMerchantUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes a captured merchant target and only optimistically updates that active merchant', async () => {
    // Arrange — the selected merchant was captured before an async workflow.
    const supabase = createSupabaseStub();
    const setMerchant = vi.fn();
    const reloadMerchant = vi.fn();
    const updateMerchant = createMerchantUpdate({
      supabase: supabase.client,
      userId: 'owner-1',
      staffAccess: ownerAccess,
      activeMerchantId: merchant.id,
      setMerchant,
      reloadMerchant,
    });

    // Act
    await updateMerchant(
      { template_id: 'modern' },
      { merchantId: 'merchant-a', skipReload: true }
    );

    // Assert — owner writes remain scoped to both the captured merchant and owner.
    expect(supabase.from).toHaveBeenCalledWith('merchants');
    expect(supabase.update).toHaveBeenCalledWith({ template_id: 'modern' });
    expect(supabase.eq).toHaveBeenNthCalledWith(1, 'id', 'merchant-a');
    expect(supabase.eq).toHaveBeenNthCalledWith(2, 'user_id', 'owner-1');
    expect(setMerchant).toHaveBeenCalledWith(expect.any(Function));
    expect(reloadMerchant).not.toHaveBeenCalled();

    const optimisticUpdater = setMerchant.mock.calls[0][0] as (
      current: MerchantData | null
    ) => MerchantData | null;
    expect(optimisticUpdater(merchant)).toBe(merchant);
  });

  it('rejects generic writes without an active or captured merchant target', async () => {
    // Arrange
    const supabase = createSupabaseStub();
    const updateMerchant = createMerchantUpdate({
      supabase: supabase.client,
      userId: 'owner-1',
      staffAccess: ownerAccess,
      activeMerchantId: null,
      setMerchant: vi.fn(),
      reloadMerchant: vi.fn(),
    });

    // Act & Assert
    await expect(updateMerchant({ template_id: 'modern' })).rejects.toThrow(
      'Cannot update merchant data without a selected merchant.'
    );
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('updates a selected merchant without reloading the implicit dashboard merchant', async () => {
    // Arrange — the dashboard context displays selected merchant B, while its
    // no-argument reload boundary resolves the signed-in owner's merchant A.
    const supabase = createSupabaseStub();
    const setMerchant = vi.fn();
    const reloadMerchant = vi.fn();
    const updateMerchant = createMerchantUpdate({
      supabase: supabase.client,
      userId: 'owner-1',
      staffAccess: ownerAccess,
      activeMerchantId: merchant.id,
      setMerchant,
      reloadMerchant,
    });

    // Act
    await updateMerchant(
      { business_name: 'Updated Baci B' },
      { merchantId: merchant.id }
    );

    // Assert — keep the update inside B's context instead of allowing the
    // implicit reload to replace it with A.
    expect(reloadMerchant).not.toHaveBeenCalled();
    expect(setMerchant).toHaveBeenCalledWith(expect.any(Function));

    const selectedMerchantUpdater = setMerchant.mock.calls[0][0] as (
      current: MerchantData | null
    ) => MerchantData | null;
    expect(selectedMerchantUpdater(merchant)).toEqual({
      ...merchant,
      business_name: 'Updated Baci B',
    });

    const implicitMerchant = { ...merchant, id: 'merchant-a' };
    expect(selectedMerchantUpdater(implicitMerchant)).toBe(implicitMerchant);
  });

  it('purges merchant and blog caches after a branding update', async () => {
    // Arrange
    mockApiPost.mockResolvedValueOnce({ success: true });
    const supabase = createSupabaseStub();
    const updateMerchant = createMerchantUpdate({
      supabase: supabase.client,
      userId: 'owner-1',
      staffAccess: ownerAccess,
      activeMerchantId: merchant.id,
      setMerchant: vi.fn(),
      reloadMerchant: vi.fn(),
    });

    // Act
    await updateMerchant(
      { brand_colors: { primary: '#fff', accent: '#000', background: '#111' } },
      { merchantId: merchant.id, skipReload: true }
    );

    // Assert
    expect(mockApiPost).toHaveBeenCalledWith('/api/cache/revalidate', {
      merchantId: merchant.id,
      targets: ['merchant', 'blog'],
    });
  });

  it('keeps a successful branding write when cache revalidation fails', async () => {
    // Arrange
    mockApiPost.mockRejectedValueOnce(new Error('purge unavailable'));
    const supabase = createSupabaseStub();
    const setMerchant = vi.fn();
    const updateMerchant = createMerchantUpdate({
      supabase: supabase.client,
      userId: 'owner-1',
      staffAccess: ownerAccess,
      activeMerchantId: merchant.id,
      setMerchant,
      reloadMerchant: vi.fn(),
    });

    // Act
    await updateMerchant(
      { logo_url: 'https://images.example.com/logo.png' },
      { merchantId: merchant.id, skipReload: true }
    );

    // Assert
    expect(supabase.update).toHaveBeenCalledWith({
      logo_url: 'https://images.example.com/logo.png',
    });
    expect(setMerchant).toHaveBeenCalledWith(expect.any(Function));
  });

  it('updates local merchant state before branding cache revalidation settles', async () => {
    // Arrange
    let resolveRevalidation: (() => void) | undefined;
    mockApiPost.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRevalidation = () => resolve({ success: true });
      })
    );
    const supabase = createSupabaseStub();
    const setMerchant = vi.fn();
    const updateMerchant = createMerchantUpdate({
      supabase: supabase.client,
      userId: 'owner-1',
      staffAccess: ownerAccess,
      activeMerchantId: merchant.id,
      setMerchant,
      reloadMerchant: vi.fn(),
    });

    // Act
    const update = updateMerchant(
      { business_name: 'Updated branding' },
      { merchantId: merchant.id, skipReload: true }
    );
    await Promise.resolve();

    // Assert
    expect(setMerchant).toHaveBeenCalledWith(expect.any(Function));
    expect(resolveRevalidation).toEqual(expect.any(Function));
    resolveRevalidation?.();
    await update;
  });
});
