import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ReceiptCampaignSummary from '@/app/dashboard/migrations/receipt-campaign-summary';

const baseReceiptCampaign = {
  appDownloadClickCount: 3,
  appDownloadClickedCount: 1,
  claimedAppCount: 1,
  claimedCount: 1,
  claimedUnknownCount: 0,
  claimedWebCount: 0,
  clickedAppCount: 0,
  clickedCount: 1,
  clickedUnknownCount: 0,
  clickedWebCount: 1,
  lastActivityAt: '2026-06-27T10:05:00.000Z',
  loginStartedAppCount: 0,
  loginStartedCount: 1,
  loginStartedUnknownCount: 0,
  loginStartedWebCount: 1,
  recipients: [
    {
      appDownloadClickCount: 3,
      claimedAt: '2026-06-27T10:05:00.000Z',
      claimedSource: 'app' as const,
      clickCount: 2,
      customerEmail: 'customer@example.com',
      customerName: 'Customer Example',
      firstAppDownloadClickedAt: '2026-06-27T10:03:00.000Z',
      firstAppDownloadSource: 'app_store' as const,
      firstClickedAt: '2026-06-27T10:00:00.000Z',
      firstClickSource: 'web' as const,
      firstLoginStartedAt: '2026-06-27T10:02:00.000Z',
      firstLoginStartedSource: 'web' as const,
      id: 'claim-1',
      lastAppDownloadClickedAt: '2026-06-27T10:04:00.000Z',
      lastAppDownloadSource: 'play_store' as const,
      lastClickedAt: '2026-06-27T10:01:00.000Z',
      lastClickSource: 'web' as const,
      lastLoginStartedAt: '2026-06-27T10:02:00.000Z',
      lastLoginStartedSource: 'web' as const,
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
    expect(screen.getAllByText('Web 1 · App 0')).toHaveLength(2);
    expect(screen.getByText('Web 0 · App 1')).toBeInTheDocument();
    expect(screen.getByText('Store-link taps')).toBeInTheDocument();
    expect(screen.getByText('1 recipient')).toBeInTheDocument();
    expect(screen.getByText('Claimed via app')).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === 'Store taps: 3')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Receipt campaign recipients' })
    ).toHaveAttribute('tabindex', '0');
  });

  it('uses the job summary sent count fallback in the visible sent metric', () => {
    render(
      <ReceiptCampaignSummary
        receiptCampaign={{
          ...baseReceiptCampaign,
          sentCount: 0,
        }}
        sentCountFallback={4}
      />
    );

    expect(
      screen.getByText('Emails sent').nextElementSibling
    ).toHaveTextContent('4');
    expect(screen.getByText(/claim rate 25%/i)).toBeInTheDocument();
  });

  it('shows unknown channel counts when attribution is unavailable', () => {
    render(
      <ReceiptCampaignSummary
        receiptCampaign={{
          ...baseReceiptCampaign,
          claimedCount: 2,
          claimedUnknownCount: 1,
          clickedCount: 2,
          clickedUnknownCount: 1,
          loginStartedCount: 2,
          loginStartedUnknownCount: 1,
        }}
        sentCountFallback={0}
      />
    );

    expect(screen.getAllByText('Web 1 · App 0 · Unknown 1')).toHaveLength(2);
    expect(screen.getByText('Web 0 · App 1 · Unknown 1')).toBeInTheDocument();
  });

  it('renders the empty recipient fallback', () => {
    render(
      <ReceiptCampaignSummary
        receiptCampaign={{
          ...baseReceiptCampaign,
          appDownloadClickCount: 0,
          appDownloadClickedCount: 0,
          claimedAppCount: 0,
          claimedCount: 0,
          claimedUnknownCount: 0,
          claimedWebCount: 0,
          clickedAppCount: 0,
          clickedCount: 0,
          clickedUnknownCount: 0,
          clickedWebCount: 0,
          loginStartedAppCount: 0,
          loginStartedCount: 0,
          loginStartedUnknownCount: 0,
          loginStartedWebCount: 0,
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
