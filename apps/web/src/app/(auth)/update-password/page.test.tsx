import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRouterPush, mockUpdateUser } = vi.hoisted(() => ({
  mockRouterPush: vi.fn(),
  mockUpdateUser: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      updateUser: mockUpdateUser,
    },
  }),
}));

import UpdatePasswordPage from './page';

describe('UpdatePasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates the password and redirects to login after success', async () => {
    vi.useFakeTimers();
    render(<UpdatePasswordPage />);

    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'new-secret-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockUpdateUser).toHaveBeenCalledWith({
      password: 'new-secret-password',
    });
    expect(screen.getByText('Password Updated!')).toBeVisible();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockRouterPush).toHaveBeenCalledWith('/login');
  });

  it('shows the Supabase update error without switching to success state', async () => {
    mockUpdateUser.mockResolvedValueOnce({
      error: { message: 'Password reset session expired' },
    });

    render(<UpdatePasswordPage />);

    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'new-secret-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

    expect(
      await screen.findByText('Password reset session expired')
    ).toBeVisible();
    expect(screen.queryByText('Password Updated!')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Update Password' })
    ).toBeEnabled();
  });
});
