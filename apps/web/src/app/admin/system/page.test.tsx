import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockToast = vi.fn();
const mockFetchWithCsrf = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: (...args: unknown[]) => mockFetchWithCsrf(...args),
}));

import SystemHealthPage from './page';

describe('SystemHealthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          checkedAt: '2026-03-20T10:00:00.000Z',
          health: [],
          indexRecommendations: [],
          missingIndexes: [],
        }),
        ok: true,
      }) as unknown as typeof fetch
    );
    mockFetchWithCsrf.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses CSRF-aware refresh requests for analytics view refreshes', async () => {
    const user = userEvent.setup();
    render(<SystemHealthPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/db-health', {
        signal: expect.any(AbortSignal),
      });
    });

    await user.click(screen.getByTestId('header-refresh-analytics-views'));

    await waitFor(() => {
      expect(mockFetchWithCsrf).toHaveBeenCalledWith('/api/admin/analytics', {
        method: 'POST',
      });
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Analytics views are being refreshed.',
      });
    });
  });
});
