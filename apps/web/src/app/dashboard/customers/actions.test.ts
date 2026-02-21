import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEnsurePermission = vi.fn();
const mockCreateClient = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/merchant-server', () => ({
  ensurePermission: (...args: unknown[]) => mockEnsurePermission(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

const { createCustomer, getCustomer, getCustomers } = await import('./actions');

describe('customer actions staff access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prevents cross-merchant reads when provided merchantId does not match access context', async () => {
    const fromMock = vi.fn();
    mockCreateClient.mockReturnValue({ from: fromMock });

    mockEnsurePermission.mockResolvedValue({
      merchant: { id: 'merchant-staff' },
      staffAccess: { isOwner: false, isStaff: true, role: 'customer_service' },
    });

    const result = await getCustomers('other-merchant');

    expect(mockEnsurePermission).toHaveBeenCalledWith('customers', 'view');
    expect(result).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('creates customer using authorized merchant id from permission context', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: { id: 'customer-1' },
      error: null,
    });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });

    mockCreateClient.mockReturnValue({
      from: vi.fn(() => ({
        insert: insertMock,
      })),
    });

    mockEnsurePermission.mockResolvedValue({
      merchant: { id: 'merchant-staff' },
      staffAccess: { isOwner: false, isStaff: true, role: 'customer_service' },
    });

    await createCustomer({
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      phone: '+2348012345678',
      address: '123 Test Street',
    });

    expect(mockEnsurePermission).toHaveBeenCalledWith('customers', 'create');
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ merchant_id: 'merchant-staff' })
    );
  });

  it('loads customer details with merchant scope from staff permission context', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'customer-1',
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@example.com',
      },
      error: null,
    });
    const eqMerchantMock = vi.fn().mockReturnValue({ single: singleMock });
    const eqIdMock = vi.fn().mockReturnValue({ eq: eqMerchantMock });

    mockCreateClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: eqIdMock })),
      })),
    });

    mockEnsurePermission.mockResolvedValue({
      merchant: { id: 'merchant-staff' },
      staffAccess: { isOwner: false, isStaff: true, role: 'customer_service' },
    });

    const result = await getCustomer('customer-1');

    expect(mockEnsurePermission).toHaveBeenCalledWith('customers', 'view');
    expect(eqMerchantMock).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-staff'
    );
    expect(result?.id).toBe('customer-1');
  });
});
