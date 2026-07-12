import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  status: vi.fn(),
}));
vi.mock('./usdt-wallet-funding-api', () => ({
  usdtWalletFundingApi: mocks,
}));

import { UsdtWalletFundingPanel } from './UsdtWalletFundingPanel';

describe('UsdtWalletFundingPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.initialize.mockResolvedValue({
      amount: 65,
      chain: 'TRX',
      depositAddress: 'TVaultAddress',
      kind: 'ready',
      reference: 'wusdt_ref',
    });
    mocks.status.mockResolvedValue({
      amount: 65,
      chain: 'TRX',
      depositAddress: null,
      fundingStatus: 'pending',
      kind: 'ready',
    });
  });

  it('shows the isolated USDT balance and creates a deposit address', async () => {
    const user = userEvent.setup();
    render(
      <UsdtWalletFundingPanel
        balance={12.5}
        initialAmount={65}
        merchantSlug="ogabassey"
        onFunded={vi.fn()}
      />
    );

    expect(screen.getByText('12.50 USDT')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Address line'), '1 Baci Street');
    await user.type(screen.getByLabelText('City'), 'Lagos');
    await user.type(screen.getByLabelText('Postal code'), '100001');
    await user.click(
      screen.getByRole('button', { name: /create deposit address/i })
    );

    expect(await screen.findByText('TVaultAddress')).toBeInTheDocument();
    expect(mocks.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 65, chain: 'TRX' })
    );
  });

  it('resumes status polling from a redirected funding reference', async () => {
    mocks.status.mockResolvedValue({
      amount: 65,
      chain: 'TRX',
      depositAddress: 'TResumedAddress',
      fundingStatus: 'pending',
      kind: 'ready',
    });

    render(
      <UsdtWalletFundingPanel
        balance={0}
        initialReference="wusdt_ref_123456"
        merchantSlug="ogabassey"
        onFunded={vi.fn()}
      />
    );

    expect(await screen.findByText('TResumedAddress')).toBeInTheDocument();
    expect(mocks.status).toHaveBeenCalledWith(
      'wusdt_ref_123456',
      'ogabassey'
    );
    expect(mocks.initialize).not.toHaveBeenCalled();
  });
});
