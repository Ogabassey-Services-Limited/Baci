import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WalletClient from './wallet-client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('./actions', () => ({
  updateWalletSettings: vi.fn(),
}));

describe('WalletClient', () => {
  it('formats merchant wallet balances with the payout currency', () => {
    render(
      <WalletClient
        merchantId="merchant-1"
        payoutCurrency="INR"
        wallet={{
          id: 'wallet-1',
          availableBalance: 2500,
          pendingBalance: 500,
          upcomingBalance: 750,
          upcomingCount: 1,
          totalEarned: 5000,
          totalWithdrawn: 1000,
          autoPayoutEnabled: false,
          autoPayoutDay: 'monday',
          minPayoutAmount: 1000,
          lastPayoutAt: null,
          lastPayoutAmount: null,
          canWithdraw: false,
          nextSettlementDate: null,
          nextSettlementAmount: null,
        }}
        pendingSettlements={[
          {
            id: 'settlement-1',
            amount: 750,
            gateway: 'paystack',
            sourceType: 'order',
            expectedDate: '2026-06-01T00:00:00.000Z',
            description: 'Order settlement',
          },
        ]}
        transactions={[
          {
            id: 'tx-1',
            type: 'credit',
            amount: 2500,
            balanceAfter: 2500,
            status: 'completed',
            description: 'Order payment',
            createdAt: '2026-05-28T10:00:00.000Z',
          },
        ]}
      />
    );

    expect(screen.getByText('₹2,500')).toBeInTheDocument();
    expect(screen.getByText('+₹2,500')).toBeInTheDocument();
    expect(screen.getByText('₹5,000')).toBeInTheDocument();
    expect(screen.getByText('+₹750')).toBeInTheDocument();
    expect(screen.queryByText(/₦/)).not.toBeInTheDocument();
  });

  it('falls back to NGN when payout currency is missing', () => {
    render(
      <WalletClient
        merchantId="merchant-1"
        payoutCurrency={null}
        wallet={{
          id: 'wallet-1',
          availableBalance: 2500,
          pendingBalance: 500,
          upcomingBalance: 750,
          upcomingCount: 1,
          totalEarned: 5000,
          totalWithdrawn: 1000,
          autoPayoutEnabled: false,
          autoPayoutDay: 'monday',
          minPayoutAmount: 1000,
          lastPayoutAt: null,
          lastPayoutAmount: null,
          canWithdraw: false,
          nextSettlementDate: null,
          nextSettlementAmount: null,
        }}
        pendingSettlements={[]}
        transactions={[]}
      />
    );

    expect(screen.getByText('₦2,500')).toBeInTheDocument();
    expect(screen.getByText('₦5,000')).toBeInTheDocument();
    expect(screen.queryByText(/₹|INR/)).not.toBeInTheDocument();
  });
});
