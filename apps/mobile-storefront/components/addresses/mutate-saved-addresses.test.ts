import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Alert } from 'react-native';
import {
  deleteAddressRecord,
  persistDefaultAddress,
} from './mutate-saved-addresses';
import type { Address } from './types';

type SingleResult = {
  data: { saved_addresses: Address[] } | null;
  error: Error | null;
};
type UpdateResult = { data: { id: string }[] | null; error: Error | null };

const mockSingle = jest.fn<() => Promise<SingleResult>>();
const mockUpdateSelect = jest.fn<() => Promise<UpdateResult>>();
const mockUpdatePayload = jest.fn<(payload: unknown) => void>();
const mockLogError = jest.fn();

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ error: (...args: unknown[]) => mockLogError(...args) }),
}));

jest.mock('@/lib/saved-addresses', () => ({
  normalizeSavedAddresses: (addresses: Address[]) => addresses,
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      // Read path: select(...).eq().eq().single()
      // Write path: update(...).eq().eq().select('id')
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => mockSingle(),
          }),
        }),
      }),
      update: (payload: unknown) => {
        mockUpdatePayload(payload);
        return {
          eq: () => ({
            eq: () => ({
              select: () => mockUpdateSelect(),
            }),
          }),
        };
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

const params = {
  addressId: 'addr-1',
  customerId: 'customer-1',
  merchantId: 'merchant-1',
};

describe('persistDefaultAddress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  it('writes against freshly fetched data, not a stale local snapshot', async () => {
    // Arrange: server now has an extra address added concurrently elsewhere.
    mockSingle.mockResolvedValue({
      data: {
        saved_addresses: [address('addr-1'), address('addr-2', true)],
      },
      error: null,
    });
    mockUpdateSelect.mockResolvedValue({ data: [{ id: 'customer-1' }], error: null });

    // Act
    const result = await persistDefaultAddress(params);

    // Assert: addr-2 (only known to the server) is preserved in the write.
    expect(result).toBe(true);
    const written = mockUpdatePayload.mock.calls[0][0] as {
      saved_addresses: Address[];
    };
    expect(written.saved_addresses).toHaveLength(2);
    expect(
      written.saved_addresses.find((a) => a.id === 'addr-1')?.is_default
    ).toBe(true);
    expect(
      written.saved_addresses.find((a) => a.id === 'addr-2')?.is_default
    ).toBe(false);
  });

  it('fails and alerts when the target address no longer exists on the server', async () => {
    // Arrange
    mockSingle.mockResolvedValue({
      data: { saved_addresses: [address('addr-other')] },
      error: null,
    });

    // Act
    const result = await persistDefaultAddress(params);

    // Assert
    expect(result).toBe(false);
    expect(mockUpdatePayload).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to set default address'
    );
  });

  it('fails when no customer row matched the update', async () => {
    // Arrange
    mockSingle.mockResolvedValue({
      data: { saved_addresses: [address('addr-1')] },
      error: null,
    });
    mockUpdateSelect.mockResolvedValue({ data: [], error: null });

    // Act
    const result = await persistDefaultAddress(params);

    // Assert
    expect(result).toBe(false);
    expect(mockLogError).toHaveBeenCalled();
  });
});

describe('deleteAddressRecord', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  it('removes the address from freshly fetched data and returns the new list', async () => {
    // Arrange
    mockSingle.mockResolvedValue({
      data: {
        saved_addresses: [address('addr-1'), address('addr-2')],
      },
      error: null,
    });
    mockUpdateSelect.mockResolvedValue({ data: [{ id: 'customer-1' }], error: null });

    // Act
    const result = await deleteAddressRecord(params);

    // Assert
    expect(result).toEqual([address('addr-2')]);
    const written = mockUpdatePayload.mock.calls[0][0] as {
      saved_addresses: Address[];
    };
    expect(written.saved_addresses.map((a) => a.id)).toEqual(['addr-2']);
  });

  it('returns null and alerts when the re-fetch fails', async () => {
    // Arrange
    mockSingle.mockResolvedValue({
      data: null,
      error: new Error('fetch failed'),
    });

    // Act
    const result = await deleteAddressRecord(params);

    // Assert
    expect(result).toBeNull();
    expect(mockUpdatePayload).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to delete address'
    );
  });

  it('returns null when no customer row matched the delete update', async () => {
    // Arrange
    mockSingle.mockResolvedValue({
      data: { saved_addresses: [address('addr-1')] },
      error: null,
    });
    mockUpdateSelect.mockResolvedValue({ data: null, error: null });

    // Act
    const result = await deleteAddressRecord(params);

    // Assert
    expect(result).toBeNull();
    expect(mockLogError).toHaveBeenCalled();
  });
});
