import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { updateCustomerProfile } from './update-customer-profile';

describe('updateCustomerProfile', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('PATCHes the customer route with the merchant slug and returns success', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const result = await updateCustomerProfile('ogabassey', {
      date_of_birth: '1990-06-15',
    });

    expect(result).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/storefront/customer',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          date_of_birth: '1990-06-15',
          merchantSlug: 'ogabassey',
        }),
      })
    );
  });

  it('returns the server error message on a non-ok response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Invalid input' }),
    });

    const result = await updateCustomerProfile('ogabassey', {
      date_of_birth: '1990-06-15',
    });

    expect(result).toEqual({ success: false, error: 'Invalid input' });
  });

  it('falls back to a generic message when the error body has no error string', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });

    const result = await updateCustomerProfile('ogabassey', {});

    expect(result).toEqual({ success: false, error: 'Update failed' });
  });

  it('returns a network error when the request throws', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    const result = await updateCustomerProfile('ogabassey', {
      date_of_birth: '1990-06-15',
    });

    expect(result).toEqual({
      success: false,
      error: 'Network error. Please try again.',
    });
  });
});
