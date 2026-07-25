import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { updateCustomerProfile } from './update-customer-profile';

const mockFetchWithCsrf = vi.fn();

// The helper now goes through fetchWithCsrf so the double-submit CSRF token is
// attached (and refreshed/retried on a 403). Mock that boundary instead of the
// global fetch.
vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: (...args: unknown[]) => mockFetchWithCsrf(...args),
}));

describe('updateCustomerProfile', () => {
  beforeEach(() => {
    mockFetchWithCsrf.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('PATCHes the customer route via fetchWithCsrf and returns success', async () => {
    mockFetchWithCsrf.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const result = await updateCustomerProfile('ogabassey', {
      date_of_birth: '1990-06-15',
    });

    expect(result).toEqual({ success: true });
    expect(mockFetchWithCsrf).toHaveBeenCalledWith(
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
    mockFetchWithCsrf.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Invalid input' }),
    });

    const result = await updateCustomerProfile('ogabassey', {
      date_of_birth: '1990-06-15',
    });

    expect(result).toEqual({ success: false, error: 'Invalid input' });
  });

  it('falls back to a generic message when the error body has no error string', async () => {
    mockFetchWithCsrf.mockResolvedValue({ ok: false, json: async () => ({}) });

    const result = await updateCustomerProfile('ogabassey', {});

    expect(result).toEqual({ success: false, error: 'Update failed' });
  });

  it('returns a network error when the request throws', async () => {
    mockFetchWithCsrf.mockRejectedValue(new Error('offline'));

    const result = await updateCustomerProfile('ogabassey', {
      date_of_birth: '1990-06-15',
    });

    expect(result).toEqual({
      success: false,
      error: 'Network error. Please try again.',
    });
  });
});
