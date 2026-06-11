import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutAuthModal } from './checkout-auth-modal';

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
    },
  }),
}));

describe('CheckoutAuthModal', () => {
  beforeEach(() => {
    mocks.signInWithPassword.mockReset();
  });

  it('keeps a live region mounted and marks the form busy while signing in', async () => {
    mocks.signInWithPassword.mockReturnValue(new Promise(() => undefined));

    render(
      <CheckoutAuthModal isOpen onOpenChange={vi.fn()} onSuccess={vi.fn()} />
    );

    const form = screen.getByLabelText('Email').closest('form');
    expect(form).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByRole('status')).toHaveTextContent('');

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'customer@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secure-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(form).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByRole('status')).toHaveTextContent('Signing in.');
    });
  });
});
