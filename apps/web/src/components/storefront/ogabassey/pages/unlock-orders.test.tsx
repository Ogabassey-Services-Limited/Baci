import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const list = vi.hoisted(() => vi.fn());
vi.mock('./imei-remediation-api', () => ({
  imeiRemediationApi: { list },
}));

import { OgabasseyUnlockOrders } from './unlock-orders';

describe('OgabasseyUnlockOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    list.mockResolvedValue([
      {
        amountNgn: 100_000,
        amountUsdt: null,
        carrier: 'AT&T',
        completedAt: null,
        createdAt: '2026-07-11T12:00:00.000Z',
        customerMessage: 'The carrier is processing your request.',
        deviceModel: 'iPhone 17 Pro Max',
        id: 'order-1',
        paymentCurrency: 'NGN',
        refundPolicy: 'refundable',
        status: 'in_progress',
        successRate: 82,
        turnaround: '1-7 Days',
        updatedAt: '2026-07-11T12:03:00.000Z',
      },
    ]);
  });

  it('renders customer-safe carrier unlock tracking details', async () => {
    render(<OgabasseyUnlockOrders />);

    expect(await screen.findByText('iPhone 17 Pro Max')).toBeInTheDocument();
    expect(screen.getByText('AT&T')).toBeInTheDocument();
    expect(screen.getByText(/in progress/i)).toBeInTheDocument();
    expect(screen.getByText(/₦100,000/)).toBeInTheDocument();
    expect(screen.queryByText(/provider order/i)).toBeNull();
  });
});
