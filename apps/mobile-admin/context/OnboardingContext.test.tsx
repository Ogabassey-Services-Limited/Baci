import { act, renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const asyncStorageMock = vi.hoisted(() => ({
  getItem: vi.fn<(key: string) => Promise<string | null>>(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));

vi.mock('@/lib/storage', () => ({
  asyncStorage: asyncStorageMock,
}));

import { OnboardingProvider, useOnboarding } from './OnboardingContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <OnboardingProvider>{children}</OnboardingProvider>
);

describe('OnboardingContext', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = {};
    asyncStorageMock.getItem.mockImplementation(async (key) => {
      return mockStorage[key] ?? null;
    });
    asyncStorageMock.setItem.mockImplementation(async (key, value) => {
      mockStorage[key] = value;
    });
    asyncStorageMock.removeItem.mockImplementation(async (key) => {
      delete mockStorage[key];
    });
  });

  it('checks onboarding status on mount and sets hasSeenOnboarding to false if not found', async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasSeenOnboarding).toBe(false);
    expect(asyncStorageMock.getItem).toHaveBeenCalledWith(
      'baci_has_seen_onboarding'
    );
  });

  it('sets hasSeenOnboarding to true if storage contains "true"', async () => {
    mockStorage.baci_has_seen_onboarding = 'true';

    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasSeenOnboarding).toBe(true);
  });

  it('calls completeOnboarding and updates state & storage', async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.completeOnboarding();
    });

    await waitFor(() => {
      expect(result.current.hasSeenOnboarding).toBe(true);
    });
    expect(asyncStorageMock.setItem).toHaveBeenCalledWith(
      'baci_has_seen_onboarding',
      'true'
    );
  });

  it('calls resetOnboarding and updates state & storage', async () => {
    mockStorage.baci_has_seen_onboarding = 'true';

    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.resetOnboarding();
    });

    await waitFor(() => {
      expect(result.current.hasSeenOnboarding).toBe(false);
    });
    expect(asyncStorageMock.removeItem).toHaveBeenCalledWith(
      'baci_has_seen_onboarding'
    );
  });

  it('throws an error if useOnboarding is used outside of OnboardingProvider', () => {
    // Suppress console.error in vitest output for expected error throw
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() => renderHook(() => useOnboarding())).toThrow(
      'useOnboarding must be used within an OnboardingProvider'
    );

    consoleError.mockRestore();
  });
});
