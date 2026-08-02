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

  it('forwards expected_user_id in the body when provided', async () => {
    // Regression (is6TybOW): the intended shopper is pinned so the server can
    // reject a stale write after an account switch.
    mockFetchWithCsrf.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    await updateCustomerProfile(
      'ogabassey',
      { date_of_birth: '1990-06-15' },
      'user-123'
    );

    expect(mockFetchWithCsrf).toHaveBeenCalledWith(
      '/api/storefront/customer',
      expect.objectContaining({
        body: JSON.stringify({
          date_of_birth: '1990-06-15',
          merchantSlug: 'ogabassey',
          expected_user_id: 'user-123',
        }),
      })
    );
  });

  it('omits expected_user_id from the body when not provided', async () => {
    mockFetchWithCsrf.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    await updateCustomerProfile('ogabassey', { first_name: 'Ada' });

    const body = JSON.parse(mockFetchWithCsrf.mock.calls[0][1].body);
    expect(body).not.toHaveProperty('expected_user_id');
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
