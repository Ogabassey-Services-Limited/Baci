import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  FinancialOperations,
  NotificationOperations,
  ShippingOperations,
  WorkerOperations,
} from './operations-tables';

describe('operation tables', () => {
  it('keeps non-event operations read-only and clear when no incident is present', () => {
    render(
      <>
        <FinancialOperations
          canReadFinancials={false}
          data={{
            paymentSideEffects: [],
            payouts: [],
            reconciliationReview: [],
            settlements: [],
          }}
        />
        <NotificationOperations
          data={{ email: [], orderOutbox: [], push: [], trackingOutbox: [] }}
        />
        <ShippingOperations data={{ shipments: [], webhooks: [] }} />
        <WorkerOperations workers={[]} />
      </>
    );

    expect(
      screen.getByText('No unresolved reconciliation items.')
    ).toBeInTheDocument();
    expect(screen.getByText('No failed email attempts.')).toBeInTheDocument();
    expect(
      screen.getByText('No shipment failures require attention.')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /retry|replay/i })
    ).not.toBeInTheDocument();
  });

  it('does not label unknown settlement currency as naira', () => {
    render(
      <FinancialOperations
        canReadFinancials
        data={{
          paymentSideEffects: [],
          payouts: [],
          reconciliationReview: [],
          settlements: [
            {
              createdAt: null,
              currency: 'UNK',
              expectedSettlementDate: '2026-08-05',
              gateway: 'korapay',
              id: 'settlement-1',
              merchantId: 'merchant-1',
              merchantName: 'Unknown currency merchant',
              netAmount: 1200,
              status: 'failed',
            },
          ],
        }}
      />
    );

    expect(screen.getByText(/UNK 1\.2K/)).toBeInTheDocument();
    expect(screen.queryByText(/₦/)).not.toBeInTheDocument();
  });
});
