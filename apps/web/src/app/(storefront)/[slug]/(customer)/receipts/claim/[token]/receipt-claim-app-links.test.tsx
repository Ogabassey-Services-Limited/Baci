import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OGABASSEY_STOREFRONT_APP_STORE_URL,
  OGABASSEY_STOREFRONT_PLAY_STORE_URL,
} from '@/config/platform';
import ReceiptClaimAppLinks from './receipt-claim-app-links';

const mockFetchWithCsrf = vi.fn();

vi.mock('@/components/ui/button', () => ({
  Button: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: (...args: unknown[]) => mockFetchWithCsrf(...args),
}));

describe('ReceiptClaimAppLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWithCsrf.mockResolvedValue({ ok: true });
  });

  it('renders app store links and tracks selected store taps', async () => {
    const user = userEvent.setup();

    render(<ReceiptClaimAppLinks token="claim-token" />);

    const appStoreLink = screen.getByRole('link', { name: /app store/i });
    const playStoreLink = screen.getByRole('link', { name: /google play/i });

    expect(appStoreLink).toHaveAttribute(
      'href',
      OGABASSEY_STOREFRONT_APP_STORE_URL
    );
    expect(playStoreLink).toHaveAttribute(
      'href',
      OGABASSEY_STOREFRONT_PLAY_STORE_URL
    );

    await user.click(appStoreLink);

    expect(mockFetchWithCsrf).toHaveBeenCalledWith(
      '/api/storefront/receipts/claims/claim-token/app-download-click',
      {
        body: JSON.stringify({ target: 'app_store' }),
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        keepalive: true,
        method: 'POST',
      }
    );

    await user.click(playStoreLink);

    expect(mockFetchWithCsrf).toHaveBeenLastCalledWith(
      '/api/storefront/receipts/claims/claim-token/app-download-click',
      {
        body: JSON.stringify({ target: 'play_store' }),
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        keepalive: true,
        method: 'POST',
      }
    );
  });

  it('keeps links usable when store tap tracking fails', async () => {
    const user = userEvent.setup();
    mockFetchWithCsrf.mockRejectedValue(new Error('tracking failed'));

    render(<ReceiptClaimAppLinks token="claim-token" />);

    const appStoreLink = screen.getByRole('link', { name: /app store/i });

    await user.click(appStoreLink);

    expect(appStoreLink).toHaveAttribute(
      'href',
      OGABASSEY_STOREFRONT_APP_STORE_URL
    );
    expect(
      screen.getByRole('link', { name: /google play/i })
    ).toBeInTheDocument();
  });
});
