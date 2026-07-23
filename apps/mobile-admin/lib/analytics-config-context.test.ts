import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAnalyticsConfigContext } from './analytics-config-context';

const supabaseMocks = vi.hoisted(() => ({
  rpc: vi.fn(
    async (): Promise<{ data: unknown; error: Error | null }> => ({
      data: null,
      error: null,
    })
  ),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: supabaseMocks.rpc },
}));

describe('fetchAnalyticsConfigContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.rpc.mockImplementation(async () => ({
      data: null,
      error: null,
    }));
  });

  it('returns the merchant analytics fields and owner flag from the context RPC', async () => {
    // Arrange
    supabaseMocks.rpc.mockImplementation(async () => ({
      data: {
        merchant: {
          ga4_api_secret: 'owner-secret',
          google_analytics_id: 'G-1',
        },
        staffAccess: { isOwner: true, isStaff: false },
      },
      error: null,
    }));

    // Act
    const context = await fetchAnalyticsConfigContext();

    // Assert
    expect(supabaseMocks.rpc).toHaveBeenCalledWith('get_user_merchant_context');
    expect(context.analytics).toMatchObject({
      ga4_api_secret: 'owner-secret',
      google_analytics_id: 'G-1',
    });
    expect(context.isOwner).toBe(true);
  });

  it('reports isOwner false for staff, whose tokens the RPC redacts', async () => {
    // Arrange
    supabaseMocks.rpc.mockImplementation(async () => ({
      data: {
        merchant: { ga4_api_secret: null, google_analytics_id: 'G-1' },
        staffAccess: { isOwner: false, isStaff: true },
      },
      error: null,
    }));

    // Act
    const context = await fetchAnalyticsConfigContext();

    // Assert
    expect(context.isOwner).toBe(false);
  });

  it('throws when the RPC reports an error', async () => {
    supabaseMocks.rpc.mockImplementation(async () => ({
      data: null,
      error: new Error('rpc unavailable'),
    }));

    await expect(fetchAnalyticsConfigContext()).rejects.toThrow(
      'rpc unavailable'
    );
  });

  it('throws a merchant-not-found error when the RPC returns no context', async () => {
    await expect(fetchAnalyticsConfigContext()).rejects.toThrow(
      'Merchant profile not found'
    );
  });
});
