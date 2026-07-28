import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NetworkError } from '@/lib/api-errors';
import { useRegistration } from './useRegistration';

const mocks = vi.hoisted(() => ({ apiClient: vi.fn() }));

vi.mock('@/lib/api-client', () => ({ apiClient: mocks.apiClient }));

describe('useRegistration', () => {
  it('does not retry a failed signup and replace its specific error', async () => {
    const slugError = new NetworkError('That store URL is unavailable.', {
      statusCode: 409,
      data: { code: 'slug_unavailable' },
    });
    mocks.apiClient.mockRejectedValue(slugError);
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: 1, retryDelay: 0 },
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useRegistration(), { wrapper });

    await act(async () => {
      await expect(
        result.current.register.mutateAsync({
          businessName: 'Test Store',
          businessType: 'fashion',
          country: 'NG',
          email: 'forged@example.com',
          firstName: 'Test',
          lastName: 'Merchant',
          password: 'StrongP@ss123!',
          slug: 'test',
          slugIsCustom: false,
        })
      ).rejects.toBe(slugError);
    });

    await waitFor(() => expect(mocks.apiClient).toHaveBeenCalledTimes(1));
  });
});
