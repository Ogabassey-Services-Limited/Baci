import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/merchant-bank-form', () => ({
  MerchantBankForm: ({ merchantId }: { merchantId: string }) => (
    <div>{`Bank form for ${merchantId}`}</div>
  ),
}));

import { MerchantSettlementCard } from './merchant-settlement-card';

describe('MerchantSettlementCard', () => {
  it('renders manual invoice bank details for a non-Paystack country', () => {
    render(
      <MerchantSettlementCard
        isPaystackSupported={false}
        merchant={{
          accountName: 'Yodha Shopping',
          accountNumber: 'IN-123456789012',
          bankCode: null,
          bankName: 'HDFC Bank',
          businessName: 'Yodha Shopping',
          countryCode: 'IN',
          id: 'merchant-1',
          paystackSubaccountCode: null,
        }}
        onBankSaved={vi.fn()}
      />
    );

    expect(
      screen.getByText(/manual invoice bank details/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Bank form for merchant-1')).toBeInTheDocument();
  });
});
