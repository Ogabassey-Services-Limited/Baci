import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockFetchWithCsrf = vi.fn();

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: (...args: unknown[]) => mockFetchWithCsrf(...args),
}));

import AdminAuditPage from './page';

describe('AdminAuditPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders a privacy-safe empty audit state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          data: { events: [], nextCursor: null },
          generatedAt: '2026-08-05T10:00:00.000Z',
        }),
        ok: true,
      })
    );

    render(<AdminAuditPage />);

    expect(
      screen.getByRole('heading', { name: 'Platform audit trail' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/personal data are never shown/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/exports include up to 99 matching events/i)
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/no events match/i)).toBeInTheDocument();
    });
  });

  it('announces pagination completion to assistive technology', async () => {
    const firstEvent = {
      action: 'audit.exported',
      actorKind: 'Platform admin',
      changedFields: [],
      eventId: 'd8543bf1-5f03-4fd1-8a2a-2f7f1658c3f1',
      eventSource: 'platform',
      occurredAt: '2026-08-05T10:00:00.000Z',
      resourceType: 'audit_timeline',
    };
    const secondEvent = {
      ...firstEvent,
      action: 'merchant.updated',
      eventId: 'e5983bf1-5f03-4fd1-8a2a-2f7f1658c3f2',
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          json: async () => ({
            data: {
              events: [firstEvent],
              nextCursor: {
                id: firstEvent.eventId,
                occurredAt: firstEvent.occurredAt,
                source: firstEvent.eventSource,
              },
            },
            generatedAt: '2026-08-05T10:00:00.000Z',
          }),
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({
            data: { events: [secondEvent], nextCursor: null },
            generatedAt: '2026-08-05T10:01:00.000Z',
          }),
          ok: true,
        })
    );

    render(<AdminAuditPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Load more' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'Loaded 1 more audit event.'
      );
    });
  });
});
