import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('LoginPage', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('renders a suspense fallback while the login client is pending', async () => {
    vi.doMock('@/app/login/login-client', () => ({
      default: function PendingLoginClient() {
        throw new Promise(() => {
          // Keep the client pending so Suspense stays on the fallback.
        });
      },
    }));

    const { default: LoginPage } = await import('@/app/login/page');

    render(<LoginPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading login');
  });
});
