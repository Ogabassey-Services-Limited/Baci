import type { User } from '@supabase/supabase-js';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './auth-context';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: mocks.createClient,
}));

function AuthProbe() {
  const { loading, user } = useAuth();

  return (
    <div>
      <span>loading:{String(loading)}</span>
      <span>user:{user?.id ?? 'none'}</span>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockReturnValue(
      new Promise(() => {
        // Intentionally unresolved to verify initialUser is used immediately.
      })
    );
    mocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mocks.unsubscribe } },
    });
    mocks.createClient.mockReturnValue({
      auth: {
        getUser: mocks.getUser,
        onAuthStateChange: mocks.onAuthStateChange,
      },
    });
  });

  it('uses the server-authenticated user while client auth refreshes', () => {
    const initialUser = { id: 'user-1' } as User;

    render(
      <AuthProvider initialUser={initialUser}>
        <AuthProbe />
      </AuthProvider>
    );

    expect(screen.getByText('loading:false')).toBeInTheDocument();
    expect(screen.getByText('user:user-1')).toBeInTheDocument();
  });
});
