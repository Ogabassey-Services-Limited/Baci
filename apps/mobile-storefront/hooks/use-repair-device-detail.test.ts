import { describe, expect, it, jest } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react-native';

const mocks = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock('@/lib/repair-catalog-client', () => ({
  fetchRepairDeviceDetail: (...args: unknown[]) => mocks(...args),
  RepairCatalogUnavailableError: class RepairCatalogUnavailableError extends (
    Error
  ) {},
}));

import { useRepairDeviceDetail } from './use-repair-device-detail';

const detail = {
  device: {
    id: 'd1',
    brand: 'Apple',
    model: 'iPhone 13',
    slug: 'apple-iphone-13',
    deviceType: 'Smartphone' as const,
    imageUrl: null,
    productId: null,
  },
  quotes: [],
  product: null,
};

describe('useRepairDeviceDetail', () => {
  beforeEach(() => {
    mocks.mockReset();
  });

  it('starts loading then returns the fetched device detail', async () => {
    mocks.mockResolvedValueOnce(detail);

    const { result } = renderHook(() =>
      useRepairDeviceDetail('apple-iphone-13')
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.detail).toEqual(detail);
    expect(result.current.isNotFound).toBe(false);
    expect(mocks).toHaveBeenCalledWith('apple-iphone-13', expect.anything());
  });

  it('marks the device not found on RepairCatalogUnavailableError', async () => {
    const { RepairCatalogUnavailableError } = jest.requireMock(
      '@/lib/repair-catalog-client'
    ) as { RepairCatalogUnavailableError: new () => Error };
    mocks.mockRejectedValueOnce(new RepairCatalogUnavailableError());

    const { result } = renderHook(() => useRepairDeviceDetail('missing'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isNotFound).toBe(true);
    expect(result.current.detail).toBeNull();
  });

  it('surfaces a generic error on other failures', async () => {
    mocks.mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() => useRepairDeviceDetail('d1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('network down');
  });

  it('does not fetch when the device slug is empty', () => {
    renderHook(() => useRepairDeviceDetail(''));

    expect(mocks).not.toHaveBeenCalled();
  });
});
