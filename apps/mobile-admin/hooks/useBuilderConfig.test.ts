import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient, NetworkError } from '@/lib/api-client';
import { invalidateStoreReadiness } from '@/lib/invalidate-store-readiness';
import { useBuilderConfig } from './useBuilderConfig';

const merchantMocks = vi.hoisted(() => ({
  merchant: { id: 'merchant-1' } as { id: string } | null,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    session: { access_token: 'token-1' },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ merchant: merchantMocks.merchant }),
}));

vi.mock('@/lib/invalidate-store-readiness', () => ({
  invalidateStoreReadiness: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('expo-constants', () => ({
  default: { expoConfig: { hostUri: 'localhost:8081' } },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'token-1' } },
      }),
    },
  },
}));

vi.mock('@/lib/api-client', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api-client')>(
      '@/lib/api-client'
    );
  return {
    ...actual,
    apiClient: vi.fn(),
  };
});

const mockApiClient = vi.mocked(apiClient);
const mockInvalidateStoreReadiness = vi.mocked(invalidateStoreReadiness);

const baseConfig = {
  content: [{ type: 'Hero', props: { id: 'hero', title: 'Current' } }],
  root: { title: 'Home' },
  zones: {},
};
let latestQueryClient: QueryClient | null = null;

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  latestQueryClient = client;
  return React.createElement(QueryClientProvider, { client }, children);
}

describe('useBuilderConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient.mockResolvedValue({
      config: baseConfig,
      isPublished: false,
    });
    latestQueryClient = null;
    merchantMocks.merchant = { id: 'merchant-1' };
  });

  it('loads builder config through the centralized mobile API client', async () => {
    const { result } = renderHook(() => useBuilderConfig('home'), { wrapper });

    await waitFor(() => {
      expect(result.current.config).toEqual(baseConfig);
    });

    expect(mockApiClient).toHaveBeenCalledWith('/api/builder?slug=home');
  });

  it('keeps the current draft and shows fallback copy when AI editing is unavailable', async () => {
    mockApiClient
      .mockResolvedValueOnce({ config: baseConfig, isPublished: false })
      .mockRejectedValueOnce(
        new NetworkError('AI editor is temporarily unavailable', {
          statusCode: 503,
          data: {
            code: 'ai_provider_unavailable',
            requestId: 'req-123',
          },
        })
      );

    const { result } = renderHook(() => useBuilderConfig('home'), { wrapper });

    await waitFor(() => {
      expect(result.current.config).toEqual(baseConfig);
    });

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.sendMessage('Make it blue and green');
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe(
      'AI editor is temporarily unavailable. Your current draft is saved; please try again later.'
    );
    expect(thrown).toEqual(
      expect.objectContaining({
        code: 'ai_provider_unavailable',
        requestId: 'req-123',
      })
    );
    expect(result.current.config).toEqual(baseConfig);
    expect(result.current.messages).toEqual([
      expect.objectContaining({
        role: 'user',
        content: 'Make it blue and green',
      }),
      expect.objectContaining({
        role: 'system',
        content:
          'AI editor is temporarily unavailable. Your current draft is saved; please try again later.',
      }),
    ]);
    expect(mockApiClient).toHaveBeenLastCalledWith('/api/builder/gemini', {
      method: 'POST',
      timeout: 30_000,
      body: JSON.stringify({
        prompt: 'Make it blue and green',
        currentConfig: baseConfig,
      }),
    });
  });

  it('does not refresh readiness when saving a draft or applying an AI draft edit', async () => {
    mockApiClient
      .mockResolvedValueOnce({ config: baseConfig, isPublished: false })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        config: {
          ...baseConfig,
          root: { title: 'AI draft' },
        },
      });
    const { result } = renderHook(() => useBuilderConfig('home'), { wrapper });

    await waitFor(() => {
      expect(result.current.config).toEqual(baseConfig);
    });

    act(() => {
      result.current.saveDraft();
    });
    await waitFor(() => {
      expect(mockApiClient).toHaveBeenCalledWith('/api/builder', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'home',
          config: baseConfig,
          name: 'Home',
        }),
      });
    });

    await act(async () => {
      await result.current.sendMessage('Give the hero a brighter title');
    });

    expect(mockApiClient).toHaveBeenCalledWith('/api/builder/gemini', {
      method: 'POST',
      timeout: 30_000,
      body: JSON.stringify({
        prompt: 'Give the hero a brighter title',
        currentConfig: {
          ...baseConfig,
          root: { title: 'AI draft' },
        },
      }),
    });
    expect(mockInvalidateStoreReadiness).not.toHaveBeenCalled();
  });

  it('keeps publish pending until builder and readiness invalidations finish', async () => {
    let releaseBuilder!: () => void;
    let releaseReadiness!: () => void;
    const builder = new Promise<void>((resolve) => {
      releaseBuilder = resolve;
    });
    const readiness = new Promise<void>((resolve) => {
      releaseReadiness = resolve;
    });
    mockInvalidateStoreReadiness.mockReturnValueOnce(readiness);
    mockApiClient
      .mockResolvedValueOnce({ config: baseConfig, isPublished: false })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useBuilderConfig('home'), { wrapper });

    await waitFor(() => {
      expect(result.current.config).toEqual(baseConfig);
    });
    if (!latestQueryClient) throw new Error('Expected query client');
    vi.spyOn(latestQueryClient, 'invalidateQueries').mockReturnValue(builder);
    act(() => {
      result.current.publish();
    });

    await waitFor(() => {
      expect(mockApiClient).toHaveBeenCalledWith('/api/builder', {
        method: 'PUT',
        body: JSON.stringify({ slug: 'home' }),
      });
      expect(mockInvalidateStoreReadiness).toHaveBeenCalledWith(
        expect.anything(),
        'merchant-1'
      );
      expect(latestQueryClient?.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['builderConfig', 'home'],
      });
      expect(result.current.isPublishing).toBe(true);
    });

    releaseBuilder();
    releaseReadiness();

    await waitFor(() => {
      expect(result.current.isPublishing).toBe(false);
    });
  });

  it('does not refresh readiness when publishing fails before the publish request succeeds', async () => {
    mockApiClient
      .mockResolvedValueOnce({ config: baseConfig, isPublished: false })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ config: baseConfig, isPublished: false })
      .mockRejectedValueOnce(new Error('Publish failed'));
    const { result } = renderHook(() => useBuilderConfig('home'), { wrapper });

    await waitFor(() => {
      expect(result.current.config).toEqual(baseConfig);
    });
    act(() => {
      result.current.publish();
    });

    await waitFor(() => {
      expect(result.current.publishError).toEqual(new Error('Publish failed'));
    });
    expect(mockInvalidateStoreReadiness).not.toHaveBeenCalled();
  });

  it('keeps a successful publish successful when merchant context is temporarily unavailable', async () => {
    merchantMocks.merchant = null;
    let releasePublish!: () => void;
    const publishRequest = new Promise<void>((resolve) => {
      releasePublish = resolve;
    });
    mockApiClient.mockImplementation((url, options) => {
      if (url === '/api/builder?slug=home') {
        return Promise.resolve({ config: baseConfig, isPublished: false });
      }
      if (options?.method === 'PUT') return publishRequest;
      return Promise.resolve(undefined);
    });
    const { result } = renderHook(() => useBuilderConfig('home'), { wrapper });

    await waitFor(() => {
      expect(result.current.config).toEqual(baseConfig);
    });
    if (!latestQueryClient) throw new Error('Expected query client');
    const invalidateQueries = vi.spyOn(latestQueryClient, 'invalidateQueries');

    act(() => {
      result.current.publish();
    });

    await waitFor(() => {
      expect(mockApiClient).toHaveBeenCalledWith('/api/builder', {
        method: 'PUT',
        body: JSON.stringify({ slug: 'home' }),
      });
      expect(result.current.isPublishing).toBe(true);
    });
    releasePublish();
    await waitFor(() => {
      expect(result.current.isPublishing).toBe(false);
      expect(result.current.publishError).toBeNull();
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['builderConfig', 'home'],
    });
    expect(mockInvalidateStoreReadiness).not.toHaveBeenCalled();
  });
});
