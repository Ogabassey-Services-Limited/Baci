import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import type { createImeiRemediationClient } from '@/lib/imei-remediation-client';

type RemediationClient = ReturnType<typeof createImeiRemediationClient>;

const mockList = jest.fn<RemediationClient['list']>();
jest.mock('@/lib/imei-remediation-client', () => ({
  createImeiRemediationClient: () => ({ list: mockList }),
}));
jest.mock('@react-native-vector-icons/ionicons', () => ({
  default: () => null,
  __esModule: true,
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
  Stack: { Screen: () => null },
}));
jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

import { UnlockOrdersScreen } from './unlock-orders-screen';

describe('UnlockOrdersScreen', () => {
  it('renders customer-safe order status and currency', async () => {
    mockList.mockResolvedValue([
      {
        amountNgn: null,
        amountUsdt: 65,
        carrier: 'AT&T',
        createdAt: '2026-07-11T12:00:00.000Z',
        customerMessage: 'The carrier is processing your request.',
        deviceModel: 'iPhone 17 Pro Max',
        id: 'order-1',
        paymentCurrency: 'USDT',
        refundPolicy: 'refundable',
        status: 'in_progress',
        successRate: 82,
        turnaround: '1-7 Days',
        updatedAt: '2026-07-11T12:03:00.000Z',
      },
    ]);

    render(
      <UnlockOrdersScreen
        accessToken="token"
        apiBaseUrl="https://shop.example.com"
      />
    );

    expect(await screen.findByText('iPhone 17 Pro Max')).toBeTruthy();
    expect(screen.getByText('65.00 USDT')).toBeTruthy();
    expect(screen.getByText(/in progress/i)).toBeTruthy();
  });
});
