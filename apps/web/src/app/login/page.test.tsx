import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('LoginPage', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('renders a suspense fallback while the login client is pending', async () => {
    const pending = new Promise<never>(() => {
      // Keep the client pending so Suspense stays on the fallback.
    });

    vi.doMock('@/app/login/login-client', () => ({
      default: function PendingLoginClient() {
        throw pending;
      },
    }));

    const { default: LoginPage } = await import('@/app/login/page');

    render(<LoginPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading login');
  });

  it('renders the ready login client when it does not suspend', async () => {
    vi.doMock('@/app/login/login-client', () => ({
      default: function LoginClient() {
        return <div>Ready login client</div>;
      },
    }));

    const { default: LoginPage } = await import('@/app/login/page');

    render(<LoginPage />);

    expect(screen.getByText('Ready login client')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
