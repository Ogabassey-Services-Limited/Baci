import { render, waitFor } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIInsightsPanel } from './ai-insights-panel';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

describe('AIInsightsPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests insights for the selected merchant', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ insights: [] }), { status: 200 })
      );

    render(
      <AIInsightsPanel activeCategory="overview" merchantId="merchant-1" />
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/analytics/insights',
        expect.objectContaining({
          headers: { 'x-baci-merchant-id': 'merchant-1' },
        })
      );
    });
  });
});
