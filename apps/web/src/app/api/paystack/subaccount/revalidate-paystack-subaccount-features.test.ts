import { revalidateTag } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { revalidatePaystackSubaccountFeatures } from './revalidate-paystack-subaccount-features';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

const mockRevalidateTag = vi.mocked(revalidateTag);

describe('revalidatePaystackSubaccountFeatures', () => {
  beforeEach(() => {
    mockRevalidateTag.mockReset();
  });

  it('invalidates the merchant feature tag with the merchant profile', () => {
    revalidatePaystackSubaccountFeatures('merchant-123');

    expect(mockRevalidateTag).toHaveBeenCalledWith(
      'features-merchant-123',
      'merchant'
    );
  });

  it('propagates cache invalidation errors to the caller', () => {
    const error = new Error('cache unavailable');
    mockRevalidateTag.mockImplementationOnce(() => {
      throw error;
    });

    expect(() => revalidatePaystackSubaccountFeatures('merchant-123')).toThrow(
      error
    );
  });
});
