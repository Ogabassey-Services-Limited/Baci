import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient, NetworkError } from '@/lib/api-client';
import { useBuilderConfig } from './useBuilderConfig';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    session: { access_token: 'token-1' },
    isLoading: false,
  }),
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

const baseConfig = {
  content: [{ type: 'Hero', props: { id: 'hero', title: 'Current' } }],
  root: { title: 'Home' },
  zones: {},
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe('useBuilderConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient.mockResolvedValue({
      config: baseConfig,
      isPublished: false,
    });
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
});
