import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlatformPerformanceBreakdowns } from '@/app/admin/platform-performance-breakdowns';

describe('PlatformPerformanceBreakdowns', () => {
  it('renders channel, activation, and business type breakdowns', () => {
    render(
      <PlatformPerformanceBreakdowns
        businessTypes={[
          {
            businessType: 'fashion',
            merchants: 4,
            shareOfMerchants: 40,
          },
          {
            businessType: 'unspecified',
            merchants: 6,
            shareOfMerchants: 60,
          },
        ]}
        loading={false}
        merchantActivation={[
          {
            completionRate: 100,
            description: 'All non-admin merchant records',
            key: 'signed_up',
            label: 'Signed Up',
            merchants: 10,
          },
          {
            completionRate: 30,
            description: 'Merchants with at least one paid order',
            key: 'first_paid_order',
            label: 'First Paid Order',
            merchants: 3,
          },
        ]}
        periodLabel="last 30 days"
        salesByChannel={[
          {
            channel: 'online_store',
            gmv: 5000,
            orders: 4,
            shareOfGmv: 62.5,
            shareOfOrders: 57.1,
          },
          {
            channel: 'mobile_app',
            gmv: 3000,
            orders: 3,
            shareOfGmv: 37.5,
            shareOfOrders: 42.9,
          },
        ]}
        signupSources={[
          { source: 'web', merchants: 7, shareOfMerchants: 70 },
          { source: 'ios', merchants: 2, shareOfMerchants: 20 },
          { source: 'android', merchants: 1, shareOfMerchants: 10 },
        ]}
      />
    );

    expect(screen.getByText('Order Sources')).toBeInTheDocument();
    expect(screen.getByText('Online Store')).toBeInTheDocument();
    expect(screen.getByText('Merchant Readiness')).toBeInTheDocument();
    expect(screen.getByText('First Paid Order')).toBeInTheDocument();
    expect(screen.getByText('Fashion & Apparel · 4')).toBeInTheDocument();
    expect(screen.getByText('Unspecified · 6')).toBeInTheDocument();
    expect(screen.getByText('Signups by Platform')).toBeInTheDocument();
    expect(screen.getByText('Web Browser')).toBeInTheDocument();
    expect(screen.getByText('iOS App')).toBeInTheDocument();
    expect(screen.getByText('Android App')).toBeInTheDocument();
  });

  it('renders empty states when no breakdown data is available', () => {
    render(
      <PlatformPerformanceBreakdowns
        businessTypes={[]}
        loading={false}
        merchantActivation={[]}
        periodLabel="last 7 days"
        salesByChannel={[]}
        signupSources={[]}
      />
    );

    expect(
      screen.getByText('No order source data for this window.')
    ).toBeInTheDocument();
    expect(screen.getByText('No activation data yet.')).toBeInTheDocument();
    expect(screen.getByText('No business type data yet.')).toBeInTheDocument();
    expect(screen.getByText('No signup source data yet.')).toBeInTheDocument();
  });
});
