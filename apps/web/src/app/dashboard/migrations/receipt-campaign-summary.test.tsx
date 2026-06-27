import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ReceiptCampaignSummary from '@/app/dashboard/migrations/receipt-campaign-summary';

const baseReceiptCampaign = {
  claimedCount: 1,
  clickedCount: 1,
  lastActivityAt: '2026-06-27T10:05:00.000Z',
  loginStartedCount: 1,
  recipients: [
    {
      claimedAt: '2026-06-27T10:05:00.000Z',
      clickCount: 2,
      customerEmail: 'customer@example.com',
      customerName: 'Customer Example',
      firstClickedAt: '2026-06-27T10:00:00.000Z',
      firstLoginStartedAt: '2026-06-27T10:02:00.000Z',
      id: 'claim-1',
      lastClickedAt: '2026-06-27T10:01:00.000Z',
      lastLoginStartedAt: '2026-06-27T10:02:00.000Z',
      loginStartedCount: 1,
      notificationSentAt: '2026-06-27T09:59:00.000Z',
    },
  ],
  sentCount: 1,
  totalRecipients: 1,
};

describe('ReceiptCampaignSummary', () => {
  it('renders campaign metrics and recipient progress', () => {
    render(
      <ReceiptCampaignSummary
        receiptCampaign={baseReceiptCampaign}
        sentCountFallback={0}
      />
    );

    expect(
      screen.getByRole('heading', { name: /receipt campaign/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/claim rate 100%/i)).toBeInTheDocument();
    expect(screen.getByText('Customer Example')).toBeInTheDocument();
    expect(screen.getByText('customer@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('Claimed')).toHaveLength(2);
    expect(screen.getByText('2 clicks')).toBeInTheDocument();
  });

  it('renders the empty recipient fallback', () => {
    render(
      <ReceiptCampaignSummary
        receiptCampaign={{
          ...baseReceiptCampaign,
          claimedCount: 0,
          clickedCount: 0,
          loginStartedCount: 0,
          recipients: [],
          sentCount: 0,
          totalRecipients: 0,
        }}
        sentCountFallback={0}
      />
    );

    expect(
      screen.getByText('No receipt notification recipients yet.')
    ).toBeInTheDocument();
    expect(screen.getByText(/claim rate 0%/i)).toBeInTheDocument();
  });
});
