import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockApiDelete = vi.fn();
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

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: { children: ReactNode; open?: boolean }) =>
    open ? <div>{children}</div> : null,
  AlertDialogAction: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  AlertDialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  AlertDialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: ReactNode }) => (
    <h2>{children}</h2>
  ),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/api-client', () => ({
  apiDelete: (...args: unknown[]) => mockApiDelete(...args),
}));

import NotificationDetailsPage from './page';

type ResolvedParams = Promise<{ id: string }> & {
  status?: 'fulfilled';
  value?: { id: string };
};

const notificationResponse = {
  action_label: null,
  action_url: null,
  channels: ['in_app'],
  created_at: '2026-03-20T10:00:00.000Z',
  created_by: 'admin-1',
  deliveries: [],
  expires_at: null,
  id: 'notification-1',
  is_system: false,
  message: 'Baci will run maintenance tonight.',
  notification_type: 'info',
  priority: 'normal',
  scheduled_for: null,
  sent_at: null,
  stats: {
    read_rate: 0,
    total_dismissed: 0,
    total_read: 0,
    total_sent: 0,
  },
  target_merchant_ids: [],
  target_segment: null,
  target_type: 'all',
  template_id: null,
  title: 'Maintenance window',
};

describe('NotificationDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiDelete.mockResolvedValue({});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => notificationResponse,
        ok: true,
      }) as unknown as typeof fetch
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('deletes notifications through the CSRF-aware admin API client', async () => {
    const user = userEvent.setup();
    const params = Promise.resolve({ id: 'notification-1' }) as ResolvedParams;
    params.status = 'fulfilled';
    params.value = { id: 'notification-1' };

    render(
      <Suspense fallback={<div>Loading route</div>}>
        <NotificationDetailsPage params={params} />
      </Suspense>
    );

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Maintenance window',
      })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[1]);

    await waitFor(() => {
      expect(mockApiDelete).toHaveBeenCalledWith(
        '/api/admin/notifications/notification-1'
      );
    });

    expect(global.fetch).not.toHaveBeenCalledWith(
      '/api/admin/notifications/notification-1',
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(mockRouterPush).toHaveBeenCalledWith('/admin/notifications');
  });
});
