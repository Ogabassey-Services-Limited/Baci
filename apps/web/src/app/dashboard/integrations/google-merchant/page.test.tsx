import { render, screen } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: vi.fn(),
}));

vi.mock('@/components/dashboard/integrations/feed-url-section', () => ({
  FeedUrlSection: () => <div data-testid="feed-url-section">feed-url</div>,
}));

vi.mock(
  '@/components/dashboard/integrations/google-merchant-customer-reviews-card',
  () => ({
    GoogleMerchantCustomerReviewsCard: ({
      initialCustomSettings,
    }: {
      initialCustomSettings?: Record<string, unknown>;
    }) => (
      <div data-merchant-id={String(initialCustomSettings?.google_merchant_id)}>
        customer-reviews-card
      </div>
    ),
  })
);

vi.mock(
  '@/components/dashboard/integrations/google-merchant-readiness-card',
  () => ({
    GoogleMerchantReadinessCard: () => (
      <div data-testid="readiness-card">readiness-card</div>
    ),
  })
);

vi.mock('next/image', () => ({
  default: (props: { alt?: string }) => (
    <div data-alt={props.alt ?? ''} data-testid="mock-image" />
  ),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { useMerchant } from '@/hooks/use-merchant-client';
import GoogleMerchantPage from './page';

describe('Google Merchant dashboard page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMerchant).mockReturnValue({
      merchant: {
        slug: 'ogabassey',
        business_name: 'Ogabassey',
        feature_settings: {
          custom_settings: {
            google_merchant_id: '112524323',
          },
        },
      },
    } as never);
  });

  it('renders Customer Reviews settings and the readiness card beneath the feed URL section', () => {
    const { container } = render(<GoogleMerchantPage />);

    const feedUrlSection = screen.getByTestId('feed-url-section');
    const readinessCard = screen.getByTestId('readiness-card');

    expect(feedUrlSection).toBeInTheDocument();
    expect(readinessCard).toBeInTheDocument();
    expect(
      feedUrlSection.compareDocumentPosition(readinessCard) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.getByText('customer-reviews-card')).toHaveAttribute(
      'data-merchant-id',
      '112524323'
    );
    expect(container.textContent).toContain('Google Merchant Center');
  });
});
