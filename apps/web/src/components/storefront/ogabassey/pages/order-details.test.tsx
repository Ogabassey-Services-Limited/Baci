import type { ReactNode } from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const channel = {
    on: vi.fn(),
    subscribe: vi.fn(),
  };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);

  return {
    channel,
    createClient: vi.fn(),
    fetch: vi.fn(),
    push: vi.fn(),
    removeChannel: vi.fn(),
  };
});

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'order-1' }),
  usePathname: () => '/ogabassey/account/orders/order-1',
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/contexts/customer-auth-context', () => ({
  useCustomerAuth: () => ({
    customer: { id: 'customer-1' },
    isAuthenticated: true,
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: mocks.createClient,
}));

import { OgabasseyV2OrderDetails } from './order-details';

describe('OgabasseyV2OrderDetails', () => {
  beforeEach(() => {
    mocks.channel.on.mockClear();
    mocks.channel.subscribe.mockClear();
    mocks.channel.on.mockReturnValue(mocks.channel);
    mocks.channel.subscribe.mockReturnValue(mocks.channel);
    mocks.createClient.mockReset();
    mocks.fetch.mockReset();
    mocks.push.mockReset();
    mocks.removeChannel.mockReset();

    mocks.createClient.mockReturnValue({
      channel: vi.fn(() => mocks.channel),
      removeChannel: mocks.removeChannel,
    });

    mocks.fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: 'order-1',
        order_number: 'ORD-001',
        created_at: '2026-06-01T00:00:00.000Z',
        shipping_status: 'Processing',
        payment_status: 'paid',
        total: 1000,
        items: [],
      }),
    });

    vi.stubGlobal('fetch', mocks.fetch);
  });

  it('removes the Supabase realtime channel on unmount', async () => {
    const { unmount } = render(<OgabasseyV2OrderDetails />);

    await waitFor(() => {
      expect(mocks.channel.subscribe).toHaveBeenCalled();
    });

    unmount();

    expect(mocks.removeChannel).toHaveBeenCalledTimes(1);
    expect(mocks.removeChannel).toHaveBeenCalledWith(mocks.channel);
  });
});
