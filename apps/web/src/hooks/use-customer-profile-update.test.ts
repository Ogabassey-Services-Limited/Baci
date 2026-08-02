import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Customer, CustomerUser } from '@/contexts/customer-auth-context';
import { useCustomerProfileUpdate } from './use-customer-profile-update';

const mockUpdateProfile = vi.fn();
vi.mock('@/lib/storefront/update-customer-profile', () => ({
  updateCustomerProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}));

const customer = {
  id: 'customer-1',
  email: 'a@example.com',
  first_name: 'Ada',
  last_name: 'Lovelace',
} as Customer;
const user = {
  id: 'user-1',
  email: 'a@example.com',
  role: 'customer',
} as CustomerUser;

function setup(
  overrides: { customer?: Customer | null; user?: CustomerUser | null } = {}
) {
  const setCustomer = vi.fn();
  const view = renderHook(() =>
    useCustomerProfileUpdate({
      customer:
        overrides.customer === undefined ? customer : overrides.customer,
      merchantSlug: 'ogabassey',
      setCustomer,
      user: overrides.user === undefined ? user : overrides.user,
    })
  );
  return { view, setCustomer };
}

describe('useCustomerProfileUpdate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forwards the expected user id and merges the data on success', async () => {
    mockUpdateProfile.mockResolvedValue({ success: true });
    const { view, setCustomer } = setup();

    let result: { success: boolean } | undefined;
    await act(async () => {
      result = await view.result.current({ date_of_birth: '1990-06-15' });
    });

    expect(result).toEqual({ success: true });
    expect(mockUpdateProfile).toHaveBeenCalledWith(
      'ogabassey',
      { date_of_birth: '1990-06-15' },
      'user-1'
    );
    // The state updater merges into the same customer.
    const updater = setCustomer.mock.calls[0][0];
    expect(updater({ ...customer })).toMatchObject({
      id: 'customer-1',
      date_of_birth: '1990-06-15',
    });
  });

  it('skips the local merge when the account switched mid-write', async () => {
    // Regression (is6TybOW): the merge guard uses the LIVE prev state — if the
    // account switched, prev is a different customer and must be returned as-is.
    mockUpdateProfile.mockResolvedValue({ success: true });
    const { view, setCustomer } = setup();

    await act(async () => {
      await view.result.current({ date_of_birth: '1990-06-15' });
    });

    const updater = setCustomer.mock.calls[0][0];
    const switchedCustomer = { ...customer, id: 'customer-2' } as Customer;
    // The switched customer is returned unchanged — no cross-account merge.
    expect(updater(switchedCustomer)).toBe(switchedCustomer);
  });

  it('returns Not authenticated without calling the API when there is no customer', async () => {
    const { view, setCustomer } = setup({ customer: null });

    let result: { success: boolean; error?: string } | undefined;
    await act(async () => {
      result = await view.result.current({ date_of_birth: '1990-06-15' });
    });

    expect(result).toEqual({ success: false, error: 'Not authenticated' });
    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(setCustomer).not.toHaveBeenCalled();
  });

  it('does not merge into local state when the write fails', async () => {
    mockUpdateProfile.mockResolvedValue({ success: false, error: 'boom' });
    const { view, setCustomer } = setup();

    await act(async () => {
      await view.result.current({ date_of_birth: '1990-06-15' });
    });

    expect(setCustomer).not.toHaveBeenCalled();
  });
});
