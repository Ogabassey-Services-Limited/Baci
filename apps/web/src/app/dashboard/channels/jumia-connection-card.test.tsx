import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { JumiaConnectionCard } from './jumia-connection-card';
import type { JumiaIntegration } from './use-jumia-integrations';

vi.mock('next/image', () => ({
  default: () => <span data-testid="jumia-logo" />,
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a {...props}>{children}</a>,
}));

vi.mock('./jumia-marketplace-identity', () => ({
  JumiaMarketplaceIdentity: () => <span>Jumia Nigeria</span>,
}));

const integration: JumiaIntegration = {
  id: 'integration-1',
  shop_id: 'shop-1',
  shop_name: 'Test Shop',
  country_code: 'NG',
  marketplace_key: 'jumia-ng-main',
  is_active: true,
  last_sync_at: null,
  sync_error: null,
};

function renderCard(
  overrides: Partial<React.ComponentProps<typeof JumiaConnectionCard>> = {}
) {
  const props: React.ComponentProps<typeof JumiaConnectionCard> = {
    integrations: [integration],
    merchantId: 'merchant-1',
    onConnect: vi.fn(),
    onAddProducts: vi.fn(),
    onCheckApprovals: vi.fn(),
    approvalCheckingIds: new Set(),
    onSyncOrders: vi.fn(),
    syncingIds: new Set(),
    onSyncStock: vi.fn(),
    stockSyncingIds: new Set(),
    onDisconnect: vi.fn(),
    ...overrides,
  };
  return { ...render(<JumiaConnectionCard {...props} />), props };
}

describe('JumiaConnectionCard', () => {
  it('exposes connect when no shop is connected', async () => {
    const user = userEvent.setup();
    const onConnect = vi.fn();
    renderCard({ integrations: [], onConnect });

    await user.click(screen.getByRole('button', { name: 'Connect' }));

    expect(onConnect).toHaveBeenCalledOnce();
    expect(
      screen.getByText('Receive orders in your Baci dashboard')
    ).toBeInTheDocument();
  });

  it('routes every connected-shop action to its integration callback', async () => {
    const user = userEvent.setup();
    const onAddProducts = vi.fn();
    const onCheckApprovals = vi.fn();
    const onSyncOrders = vi.fn();
    const onSyncStock = vi.fn();
    const onDisconnect = vi.fn();
    renderCard({
      onAddProducts,
      onCheckApprovals,
      onSyncOrders,
      onSyncStock,
      onDisconnect,
    });

    await user.click(screen.getByRole('button', { name: /add products/i }));
    await user.click(screen.getByRole('button', { name: /check approvals/i }));
    await user.click(screen.getByRole('button', { name: /sync orders/i }));
    await user.click(screen.getByRole('button', { name: /sync stock/i }));
    await user.click(
      screen.getByRole('button', { name: /disconnect jumia.*test shop/i })
    );

    expect(onAddProducts).toHaveBeenCalledWith('integration-1');
    expect(onCheckApprovals).toHaveBeenCalledWith('integration-1');
    expect(onSyncOrders).toHaveBeenCalledWith('integration-1');
    expect(onSyncStock).toHaveBeenCalledWith('integration-1');
    expect(onDisconnect).toHaveBeenCalledWith('integration-1');
  });

  it('keeps Add Products disabled until a merchant is available', () => {
    renderCard({ merchantId: undefined });

    expect(
      screen.getByRole('button', { name: /add products/i })
    ).toBeDisabled();
  });
});
