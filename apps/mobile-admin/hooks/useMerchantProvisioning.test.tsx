import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiClient: vi.fn(),
  getRuntimePlatform: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({ apiClient: mocks.apiClient }));
vi.mock('@/config/runtime-platform', () => ({
  getRuntimePlatform: mocks.getRuntimePlatform,
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

import { useMerchantProvisioning } from './useMerchantProvisioning';

const payload = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  phone: '+2348012345678',
  businessName: 'Analytical Engines',
  businessType: 'technology',
  country: 'NG',
  slug: 'analytical-engines',
  slugIsCustom: true,
  logoUrl: 'https://cdn.usebaci.com/logo.png',
  brandColors: {
    primary: '#111111',
    background: '#ffffff',
    accent: '#f59e0b',
  },
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: 3 } },
  });
  client.invalidateQueries = mocks.invalidateQueries;
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useMerchantProvisioning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRuntimePlatform.mockReturnValue('ios');
    mocks.apiClient.mockResolvedValue({
      success: true,
      merchant: { id: 'merchant-1', slug: 'analytical-engines' },
      created: true,
    });
    mocks.invalidateQueries.mockResolvedValue(undefined);
  });

  it.each([
    'ios',
    'android',
  ] as const)('posts authenticated store data with exact %s platform and awaits current-user refetch', async (platform) => {
    mocks.getRuntimePlatform.mockReturnValue(platform);
    const invalidation = Promise.withResolvers<void>();
    mocks.invalidateQueries.mockReturnValue(invalidation.promise);
    const { result } = renderHook(() => useMerchantProvisioning(), {
      wrapper,
    });

    let resolved = false;
    const mutation = act(async () => {
      const promise = result.current.mutateAsync(payload).then(() => {
        resolved = true;
      });
      await vi.waitFor(() => expect(mocks.apiClient).toHaveBeenCalled());
      expect(resolved).toBe(false);
      invalidation.resolve();
      await promise;
    });
    await mutation;

    expect(mocks.apiClient).toHaveBeenCalledWith(
      '/api/mobile/merchant-provisioning',
      {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'X-Baci-Platform': platform },
      }
    );
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['merchant', 'user-1'],
      refetchType: 'active',
    });
    const serialized = JSON.stringify(mocks.apiClient.mock.calls[0]);
    for (const forbidden of [
      'email',
      'password',
      'confirmPassword',
      'userId',
      'merchantId',
      'signupSource',
      'rootDomain',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it.each([
    'web',
    'windows',
  ])('rejects unsupported runtime %s before making a request', async (platform) => {
    mocks.getRuntimePlatform.mockReturnValue(platform);
    const { result } = renderHook(() => useMerchantProvisioning(), {
      wrapper,
    });

    await act(async () => {
      await expect(result.current.mutateAsync(payload)).rejects.toThrow(
        /unsupported mobile platform/i
      );
    });
    expect(mocks.apiClient).not.toHaveBeenCalled();
  });

  it('does not retry a provisioning failure', async () => {
    mocks.apiClient.mockRejectedValue(new Error('failed'));
    const { result } = renderHook(() => useMerchantProvisioning(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(payload)).rejects.toThrow(
        'failed'
      );
    });
    expect(mocks.apiClient).toHaveBeenCalledOnce();
  });
});
