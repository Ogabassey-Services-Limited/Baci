import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockToast = vi.fn();
const mockFormAction = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock('@/app/(auth)/signup/actions', () => ({
  signupAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: ComponentProps<'a'> & { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/logo', () => ({
  Logo: () => <div data-testid="logo">Logo</div>,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useActionState: () =>
      [{ message: '', success: false }, mockFormAction, false] as const,
  };
});

import SignupForm from './signup-form';

describe('SignupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete('email');
    mockSearchParams.delete('redirect');
  });

  it('exposes accessible names for both password visibility toggles', () => {
    render(<SignupForm />);

    expect(
      screen.getAllByRole('button', { name: 'Show password' })
    ).toHaveLength(2);
  });

  it('updates the accessible name when a password field is revealed', async () => {
    const user = userEvent.setup();

    render(<SignupForm />);

    const [passwordToggle] = screen.getAllByRole('button', {
      name: 'Show password',
    });

    await user.click(passwordToggle);

    expect(
      screen.getByRole('button', { name: 'Hide password' })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Show password' })
    ).toHaveLength(1);
  });

  it('restores the accessible name when a password field is hidden again', async () => {
    const user = userEvent.setup();

    render(<SignupForm />);

    const [passwordToggle] = screen.getAllByRole('button', {
      name: 'Show password',
    });

    await user.click(passwordToggle);
    await user.click(screen.getByRole('button', { name: 'Hide password' }));

    expect(
      screen.getAllByRole('button', { name: 'Show password' })
    ).toHaveLength(2);
  });
});
