import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockApiPost = vi.fn();
const mockRouterPush = vi.fn();
const mockToast = vi.fn();

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/api-client', () => ({
  apiPost: (...args: unknown[]) => mockApiPost(...args),
}));

import CreateNotificationPage from './page';

describe('CreateNotificationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiPost.mockResolvedValue({
      merchants_notified: 3,
      status: 'sent',
    });
    vi.stubGlobal(
      'ResizeObserver',
      class ResizeObserver {
        disconnect() {
          return undefined;
        }
        observe() {
          return undefined;
        }
        unobserve() {
          return undefined;
        }
      }
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({ merchants_notified: 3, status: 'sent' }),
        ok: true,
      }) as unknown as typeof fetch
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('submits notifications through the CSRF-aware admin API client', async () => {
    const user = userEvent.setup();
    render(<CreateNotificationPage />);

    await user.type(screen.getByLabelText(/title/i), 'Maintenance window');
    await user.type(
      screen.getByLabelText(/message/i),
      'Baci will run maintenance tonight.'
    );
    await user.click(screen.getByRole('button', { name: /send now/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/admin/notifications', {
        channels: ['in_app'],
        expires_at: undefined,
        message: 'Baci will run maintenance tonight.',
        notification_type: 'info',
        priority: 'normal',
        scheduled_for: undefined,
        target_type: 'all',
        title: 'Maintenance window',
      });
    });

    expect(global.fetch).not.toHaveBeenCalledWith(
      '/api/admin/notifications',
      expect.objectContaining({ method: 'POST' })
    );
    expect(mockRouterPush).toHaveBeenCalledWith('/admin/notifications');
  });
});
