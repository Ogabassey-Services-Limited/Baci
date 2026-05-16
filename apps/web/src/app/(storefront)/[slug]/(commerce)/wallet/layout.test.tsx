import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const customerAuthLayoutMock = vi.fn(
  ({ children }: { children: ReactNode; params: { slug: string } }) => (
    <div data-testid="customer-auth-layout">{children}</div>
  )
);

vi.mock('@/app/(storefront)/[slug]/customer-auth-layout', () => ({
  default: (props: { children: ReactNode; params: { slug: string } }) =>
    customerAuthLayoutMock(props),
}));

import WalletLayout from './layout';

describe('WalletLayout', () => {
  it('wraps the wallet route in CustomerAuthLayout with the resolved slug', async () => {
    const node = await WalletLayout({
      children: <div>Wallet content</div>,
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    render(node);

    expect(screen.getByTestId('customer-auth-layout')).toBeInTheDocument();
    expect(screen.getByText('Wallet content')).toBeInTheDocument();
    expect(customerAuthLayoutMock).toHaveBeenCalledTimes(1);
    expect(customerAuthLayoutMock.mock.calls[0]?.[0]).toMatchObject({
      params: { slug: 'ogabassey' },
    });
  });
});
