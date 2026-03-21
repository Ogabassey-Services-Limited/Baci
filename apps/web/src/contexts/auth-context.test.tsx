import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './auth-context';

// Mock Supabase client
const mockSignOut = vi.fn().mockResolvedValue({ error: null });
const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: 'user-1', email: 'test@example.com' } },
});
const mockOnAuthStateChange = vi.fn().mockReturnValue({
  data: { subscription: { unsubscribe: vi.fn() } },
});

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
      signOut: mockSignOut,
      onAuthStateChange: mockOnAuthStateChange,
    },
  }),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('provides user after initialization', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual({
      id: 'user-1',
      email: 'test@example.com',
    });
  });

  it('clears browser storage on signOut', async () => {
    sessionStorage.setItem('merchant-data', 'sensitive');
    localStorage.setItem('cart', 'user-items');

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem('merchant-data')).toBeNull();
    expect(localStorage.getItem('cart')).toBeNull();
  });

  it('calls supabase signOut even if storage clear fails', async () => {
    // Simulate storage access throwing
    const originalClear = sessionStorage.clear.bind(sessionStorage);
    vi.spyOn(sessionStorage, 'clear').mockImplementation(() => {
      throw new Error('Storage access denied');
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.signOut();
    });

    // signOut should still have been called despite storage error
    expect(mockSignOut).toHaveBeenCalledOnce();

    // Restore
    vi.spyOn(sessionStorage, 'clear').mockImplementation(originalClear);
  });

  it('throws when useAuth is called outside AuthProvider', () => {
    // Suppress console.error for this expected error
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });
});
