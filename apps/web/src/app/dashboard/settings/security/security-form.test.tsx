import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoist mock references
const { mockUser, mockToast } = vi.hoisted(() => ({
  mockUser: {
    id: 'user-1',
    email: 'staff@example.com',
    identities: [{ provider: 'google', id: 'g-1' }],
    app_metadata: { provider: 'google' },
  },
  mockToast: vi.fn(),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(() => ({
    user: mockUser,
    loading: false,
  })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn(),
      updateUser: vi.fn(),
    },
  }),
}));

// Mock password-breach as a dynamic import target
vi.mock('@/lib/password-breach', () => ({
  checkPasswordBreach: vi.fn().mockResolvedValue({ isBreached: false }),
}));

import { useAuth } from '@/contexts/auth-context';

describe('SecurityForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Set Password" form for OAuth-only user', async () => {
    const { SecurityForm } = await import('./security-form');
    render(<SecurityForm />);

    // Description text unique to set-password variant
    expect(
      screen.getByText(/You signed in with a social account/)
    ).toBeDefined();

    // Should NOT have current password field
    expect(screen.queryByLabelText('Current Password')).toBeNull();

    // Should have new password and confirm fields
    expect(screen.getByLabelText('Password')).toBeDefined();
    expect(screen.getByLabelText('Confirm Password')).toBeDefined();

    // Submit button
    expect(screen.getByRole('button', { name: 'Set Password' })).toBeDefined();
  });

  it('renders "Change Password" form for user with password identity', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        ...mockUser,
        identities: [
          { provider: 'email', id: 'e-1' },
          { provider: 'google', id: 'g-1' },
        ],
      } as ReturnType<typeof useAuth>['user'],
      loading: false,
      signOut: vi.fn(),
    });

    const { SecurityForm } = await import('./security-form');
    const { container } = render(<SecurityForm />);

    // Description text unique to change-password variant
    expect(
      within(container).getByText('Update your existing password.')
    ).toBeDefined();

    // Should have all three password fields
    expect(screen.getByLabelText('Current Password')).toBeDefined();
    expect(screen.getByLabelText('New Password')).toBeDefined();
    expect(screen.getByLabelText('Confirm Password')).toBeDefined();

    // Submit button
    expect(
      screen.getByRole('button', { name: 'Change Password' })
    ).toBeDefined();
  });

  it('shows loading spinner while auth is loading', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: true,
      signOut: vi.fn(),
    });

    const { SecurityForm } = await import('./security-form');
    const { container } = render(<SecurityForm />);

    // Should show spinner, not the form
    expect(container.querySelector('.animate-spin')).toBeDefined();
    expect(screen.queryByLabelText('Password')).toBeNull();
  });

  it('shows correct provider name for Apple OAuth users', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        ...mockUser,
        identities: [{ provider: 'apple', id: 'a-1' }],
        app_metadata: { provider: 'apple' },
      } as ReturnType<typeof useAuth>['user'],
      loading: false,
      signOut: vi.fn(),
    });

    const { SecurityForm } = await import('./security-form');
    render(<SecurityForm />);

    expect(screen.getByText(/Apple/)).toBeDefined();
  });
});
