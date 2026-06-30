import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceiptClaimAppDownloadBanner } from './receipt-claim-app-download-banner';

const mockFetchWithCsrf = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: (...args: unknown[]) => mockFetchWithCsrf(...args),
}));

describe('ReceiptClaimAppDownloadBanner', () => {
  beforeEach(() => {
    mockFetchWithCsrf.mockClear();
    mockFetchWithCsrf.mockResolvedValue(new Response(null, { status: 204 }));
    mockSearchParams.delete('receiptClaimed');
  });

  it('stays hidden outside the post-claim receipts flow', () => {
    render(<ReceiptClaimAppDownloadBanner readTrackingToken={() => null} />);

    expect(screen.queryByText('Receipts ready')).not.toBeInTheDocument();
  });

  it('stays hidden when only a stored tracking token is available', async () => {
    const readTrackingToken = vi.fn(() => 'claim-token');

    render(
      <ReceiptClaimAppDownloadBanner readTrackingToken={readTrackingToken} />
    );

    await waitFor(() => {
      expect(readTrackingToken).toHaveBeenCalled();
    });
    expect(screen.queryByText('Receipts ready')).not.toBeInTheDocument();
  });

  it('shows app download links after a receipt claim redirect', () => {
    mockSearchParams.set('receiptClaimed', '1');

    render(<ReceiptClaimAppDownloadBanner readTrackingToken={() => null} />);

    expect(screen.getByText('Receipts ready')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /app store/i })).toHaveAttribute(
      'href',
      expect.stringContaining('apps.apple.com')
    );
    expect(screen.getByRole('link', { name: /google play/i })).toHaveAttribute(
      'href',
      expect.stringContaining('play.google.com')
    );
  });

  it('tracks app-store taps when a claim token is available', () => {
    mockSearchParams.set('receiptClaimed', '1');

    render(
      <ReceiptClaimAppDownloadBanner
        readTrackingToken={() => 'claim-token'}
      />
    );

    fireEvent.click(screen.getByRole('link', { name: /app store/i }));

    expect(mockFetchWithCsrf).toHaveBeenCalledWith(
      '/api/storefront/receipts/claims/claim-token/app-download-click',
      expect.objectContaining({
        body: JSON.stringify({ target: 'app_store' }),
        method: 'POST',
      })
    );
  });

  it('does not track app-store taps when no claim token is available', () => {
    mockSearchParams.set('receiptClaimed', '1');

    render(<ReceiptClaimAppDownloadBanner readTrackingToken={() => null} />);

    fireEvent.click(screen.getByRole('link', { name: /app store/i }));

    expect(mockFetchWithCsrf).not.toHaveBeenCalled();
  });
});
