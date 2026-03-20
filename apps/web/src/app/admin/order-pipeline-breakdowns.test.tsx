import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OrderPipelineBreakdowns } from '@/app/admin/order-pipeline-breakdowns';

describe('OrderPipelineBreakdowns', () => {
  it('renders payment, shipping, and payment method breakdowns', () => {
    render(
      <OrderPipelineBreakdowns
        loading={false}
        paymentMethods={[
          {
            amount: 700,
            label: 'Card',
            method: 'card',
            orders: 1,
            shareOfPaidAmount: 100,
            shareOfPaidOrders: 70,
          },
        ]}
        paymentStatuses={[
          {
            amount: 1000,
            label: 'Paid',
            orders: 2,
            shareOfAmount: 100,
            shareOfOrders: 100,
            status: 'paid',
          },
        ]}
        periodLabel="last 30 days"
        shippingStatuses={[
          {
            amount: 1000,
            label: 'Processing',
            orders: 2,
            shareOfAmount: 100,
            shareOfOrders: 100,
            status: 'processing',
          },
        ]}
      />
    );

    expect(screen.getByText('Payment Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Fulfillment Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getByText('Paid Order Methods')).toBeInTheDocument();
    expect(screen.getByText('Card')).toBeInTheDocument();
  });

  it('renders empty states when no pipeline data exists', () => {
    render(
      <OrderPipelineBreakdowns
        loading={false}
        paymentMethods={[]}
        paymentStatuses={[]}
        periodLabel="last 7 days"
        shippingStatuses={[]}
      />
    );

    expect(
      screen.getByText('No payment pipeline data for this window.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('No fulfillment pipeline data for this window.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('No paid orders for this window.')
    ).toBeInTheDocument();
  });

  it('renders loading state when loading is true', () => {
    render(
      <OrderPipelineBreakdowns
        loading
        paymentMethods={[]}
        paymentStatuses={[]}
        periodLabel="last 7 days"
        shippingStatuses={[]}
      />
    );

    expect(screen.getAllByTestId('pipeline-loading')).not.toHaveLength(0);
  });
});
