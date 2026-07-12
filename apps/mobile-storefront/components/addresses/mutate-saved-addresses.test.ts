import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Alert } from 'react-native';
import {
  deleteAddressRecord,
  fetchSavedAddress,
  persistAddress,
  persistDefaultAddress,
} from './mutate-saved-addresses';
import type { Address, AddressFormData } from './types';

type SnapshotResult = {
  data: { saved_addresses: Address[]; updated_at: string | null } | null;
  error: Error | null;
};
type UpdateResult = { data: { id: string }[] | null; error: Error | null };

const mockSingle = jest.fn<() => Promise<SnapshotResult>>();
const mockUpdateResult = jest.fn<() => Promise<UpdateResult>>();
const mockUpdatePayload = jest.fn<(payload: unknown) => void>();
// One entry per update() call: the ordered [column, value] pairs of its .eq()
// filters, so tests can assert on the optimistic updated_at version guard.
const mockUpdateEqArgs: [string, unknown][][] = [];
const mockUpdateIsArgs: [string, unknown][][] = [];
const mockLogError = jest.fn();

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    error: (...args: unknown[]) => mockLogError(...args),
  }),
}));

jest.mock('@/lib/saved-addresses', () => ({
  normalizeSavedAddresses: (addresses: Address[]) =>
    addresses.length === 1 && !addresses[0]?.is_default
      ? [{ ...addresses[0], is_default: true }]
      : addresses,
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      // Read path: select('saved_addresses, updated_at').eq().eq().single()
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => mockSingle(),
          }),
        }),
      }),
      // Write path: update(payload).eq().eq()[.eq/.is(updated_at)].select('id')
      update: (payload: unknown) => {
        mockUpdatePayload(payload);
        const eqArgs: [string, unknown][] = [];
        const isArgs: [string, unknown][] = [];
        mockUpdateEqArgs.push(eqArgs);
        mockUpdateIsArgs.push(isArgs);
        const builder = {
          eq: (column: string, value: unknown) => {
            eqArgs.push([column, value]);
            return builder;
          },
          is: (column: string, value: unknown) => {
            isArgs.push([column, value]);
            return builder;
          },
          select: () => mockUpdateResult(),
        };
        return builder;
      },
    }),
  },
}));

function address(id: string, isDefault = false): Address {
  return {
    id,
    label: id,
    full_name: 'Test User',
    phone: '08000000000',
    address: '1 Test Way',
    city: 'Ikeja',
    state: 'Lagos',
    country: 'Nigeria',
    is_default: isDefault,
  };
}

function snapshot(
  addresses: Address[],
  updatedAt: string | null = 'v1'
): SnapshotResult {
  return {
    data: { saved_addresses: addresses, updated_at: updatedAt },
    error: null,
  };
}

function formData(overrides: Partial<AddressFormData> = {}): AddressFormData {
  return {
    label: 'Home',
    full_name: 'Ada Lovelace',
    phone: '08031234567',
    address: '1 Compute Lane',
    city: 'Lagos',
    state: 'Lagos',
    postal_code: '',
    is_default: false,
    ...overrides,
  };
}

function writtenAddresses(call: number): Address[] {
  return (
    mockUpdatePayload.mock.calls[call]?.[0] as { saved_addresses: Address[] }
  ).saved_addresses;
}

const matchedRow: UpdateResult = { data: [{ id: 'customer-1' }], error: null };
const noRows: UpdateResult = { data: [], error: null };

const params = {
  addressId: 'addr-1',
  customerId: 'customer-1',
  merchantId: 'merchant-1',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateEqArgs.length = 0;
  mockUpdateIsArgs.length = 0;
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

describe('fetchSavedAddress', () => {
  it('returns the matching saved address', async () => {
    mockSingle.mockResolvedValue(
      snapshot([address('addr-1'), address('addr-2')])
    );

    const result = await fetchSavedAddress(
      'customer-1',
      'merchant-1',
      'addr-2'
    );

    expect(result?.id).toBe('addr-2');
  });

  it('returns null when the address id is not in the snapshot', async () => {
    mockSingle.mockResolvedValue(snapshot([address('addr-1')]));

    const result = await fetchSavedAddress(
      'customer-1',
      'merchant-1',
      'addr-9'
    );

    expect(result).toBeNull();
  });

  it('rejects when the snapshot fetch fails', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: new Error('fetch failed'),
    });

    await expect(
      fetchSavedAddress('customer-1', 'merchant-1', 'addr-1')
    ).rejects.toThrow('fetch failed');
  });
});

describe('persistAddress', () => {
  it('appends a new address to fresh data under the version guard', async () => {
    mockSingle.mockResolvedValue(snapshot([address('addr-1')], 'v1'));
    mockUpdateResult.mockResolvedValue(matchedRow);

    await persistAddress({
      addressId: 'new',
      customerId: 'customer-1',
      form: formData(),
      isNewAddress: true,
      merchantId: 'merchant-1',
    });

    const written = writtenAddresses(0);
    expect(written).toHaveLength(2);
    expect(written[1].id).toMatch(/^addr_\d+$/);
    expect(written[1].full_name).toBe('Ada Lovelace');
    expect(mockUpdateEqArgs[0]).toEqual([
      ['id', 'customer-1'],
      ['merchant_id', 'merchant-1'],
      ['updated_at', 'v1'],
    ]);
  });

  it('replaces an existing address in place on edit', async () => {
    mockSingle.mockResolvedValue(
      snapshot([address('addr-1'), address('addr-2')])
    );
    mockUpdateResult.mockResolvedValue(matchedRow);

    await persistAddress({
      addressId: 'addr-1',
      customerId: 'customer-1',
      form: formData({ full_name: 'Grace Hopper' }),
      isNewAddress: false,
      merchantId: 'merchant-1',
    });

    const written = writtenAddresses(0);
    expect(written.map((a) => a.id)).toEqual(['addr-1', 'addr-2']);
    expect(written[0].full_name).toBe('Grace Hopper');
    expect(written[1].full_name).toBe('Test User');
  });

  it('rejects when the edited address vanished from the server', async () => {
    mockSingle.mockResolvedValue(snapshot([address('addr-other')]));

    await expect(
      persistAddress({
        addressId: 'addr-1',
        customerId: 'customer-1',
        form: formData(),
        isNewAddress: false,
        merchantId: 'merchant-1',
      })
    ).rejects.toThrow('Address no longer exists');
    expect(mockUpdatePayload).not.toHaveBeenCalled();
  });

  it('rejects after one retry when no customer row ever matches', async () => {
    mockSingle.mockResolvedValue(snapshot([address('addr-1')]));
    mockUpdateResult.mockResolvedValue(noRows);

    await expect(
      persistAddress({
        addressId: 'addr-1',
        customerId: 'customer-1',
        form: formData(),
        isNewAddress: false,
        merchantId: 'merchant-1',
      })
    ).rejects.toThrow('No matching customer row updated');
    expect(mockSingle).toHaveBeenCalledTimes(2);
    expect(mockUpdateResult).toHaveBeenCalledTimes(2);
  });
});

describe('persistDefaultAddress', () => {
  it('writes against freshly fetched data, not a stale local snapshot', async () => {
    // Server has an extra address added concurrently elsewhere.
    mockSingle.mockResolvedValue(
      snapshot([address('addr-1'), address('addr-2', true)], 'v1')
    );
    mockUpdateResult.mockResolvedValue(matchedRow);

    const result = await persistDefaultAddress(params);

    expect(result).toBe(true);
    const written = writtenAddresses(0);
    expect(written.find((a) => a.id === 'addr-1')?.is_default).toBe(true);
    expect(written.find((a) => a.id === 'addr-2')?.is_default).toBe(false);
    expect(mockUpdateEqArgs[0]).toContainEqual(['updated_at', 'v1']);
  });

  it('guards legacy null updated_at snapshots with an is-null predicate', async () => {
    mockSingle.mockResolvedValue(snapshot([address('addr-1')], null));
    mockUpdateResult.mockResolvedValue(matchedRow);

    const result = await persistDefaultAddress(params);

    expect(result).toBe(true);
    expect(mockUpdateEqArgs[0]).toEqual([
      ['id', 'customer-1'],
      ['merchant_id', 'merchant-1'],
    ]);
    expect(mockUpdateIsArgs[0]).toEqual([['updated_at', null]]);
  });

  it('fails and alerts when the target address no longer exists on the server', async () => {
    mockSingle.mockResolvedValue(snapshot([address('addr-other')]));

    const result = await persistDefaultAddress(params);

    expect(result).toBe(false);
    expect(mockUpdatePayload).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to set default address'
    );
  });

  it('fails after one retry when no customer row matches the guarded update', async () => {
    mockSingle.mockResolvedValue(snapshot([address('addr-1')]));
    mockUpdateResult.mockResolvedValue(noRows);

    const result = await persistDefaultAddress(params);

    expect(result).toBe(false);
    expect(mockUpdateResult).toHaveBeenCalledTimes(2);
    expect(mockLogError).toHaveBeenCalled();
  });
});

describe('deleteAddressRecord', () => {
  it('removes the address from freshly fetched data and returns the new list', async () => {
    mockSingle.mockResolvedValue(
      snapshot([address('addr-1'), address('addr-2')])
    );
    mockUpdateResult.mockResolvedValue(matchedRow);

    const result = await deleteAddressRecord(params);

    expect(result).toEqual([address('addr-2', true)]);
    expect(writtenAddresses(0).map((a) => a.id)).toEqual(['addr-2']);
  });

  it('does not return duplicate ids left in the stored address list', async () => {
    mockSingle.mockResolvedValue(
      snapshot([address('addr-1'), address('addr-1'), address('addr-2')])
    );
    mockUpdateResult.mockResolvedValue(matchedRow);

    const result = await deleteAddressRecord({
      ...params,
      addressId: 'addr-2',
    });

    expect(result?.map((item) => item.id)).toEqual(['addr-1']);
    expect(writtenAddresses(0).map((item) => item.id)).toEqual(['addr-1']);
    expect(result?.[0]?.is_default).toBe(true);
  });

  it('retries once from fresh data when a concurrent edit invalidates the version guard', async () => {
    // First snapshot is already stale by write time; the retry sees addr-2,
    // which only exists in the fresh second snapshot.
    mockSingle
      .mockResolvedValueOnce(snapshot([address('addr-1')], 'v1'))
      .mockResolvedValueOnce(
        snapshot([address('addr-1'), address('addr-2')], 'v2')
      );
    mockUpdateResult
      .mockResolvedValueOnce(noRows)
      .mockResolvedValueOnce(matchedRow);

    const result = await deleteAddressRecord(params);

    expect(result).toEqual([address('addr-2', true)]);
    // The mutation was re-applied to the FRESH second snapshot.
    expect(writtenAddresses(0)).toEqual([]);
    expect(writtenAddresses(1)).toEqual([address('addr-2', true)]);
    // Each attempt carried its own snapshot's version guard.
    expect(mockUpdateEqArgs[0]).toContainEqual(['updated_at', 'v1']);
    expect(mockUpdateEqArgs[1]).toContainEqual(['updated_at', 'v2']);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('returns null and alerts when the snapshot re-fetch fails', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: new Error('fetch failed'),
    });

    const result = await deleteAddressRecord(params);

    expect(result).toBeNull();
    expect(mockUpdatePayload).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to delete address'
    );
  });

  it('returns null when no customer row matches after the retry', async () => {
    mockSingle.mockResolvedValue(snapshot([address('addr-1')]));
    mockUpdateResult.mockResolvedValue(noRows);

    const result = await deleteAddressRecord(params);

    expect(result).toBeNull();
    expect(mockUpdateResult).toHaveBeenCalledTimes(2);
    expect(mockLogError).toHaveBeenCalled();
  });
});
