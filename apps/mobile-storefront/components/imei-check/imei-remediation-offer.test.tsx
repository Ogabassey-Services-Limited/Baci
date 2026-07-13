import { describe, expect, it, jest } from '@jest/globals';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { router } from 'expo-router';
import Colors from '@/constants/Colors';
import type { createImeiRemediationClient } from '@/lib/imei-remediation-client';

type RemediationClient = ReturnType<typeof createImeiRemediationClient>;

const mockEligibility = jest.fn<RemediationClient['eligibility']>();
const mockPlace = jest.fn<RemediationClient['place']>();
jest.mock('@/lib/imei-remediation-client', () => ({
  createImeiRemediationClient: () => ({
    eligibility: mockEligibility,
    place: mockPlace,
  }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));
jest.mock('@react-native-vector-icons/ionicons', () => ({
  default: () => null,
  __esModule: true,
}));

import { ImeiRemediationOffer } from './imei-remediation-offer';

const offer = {
  carrier: 'AT&T',
  id: '33333333-3333-4333-8333-333333333333',
  name: 'AT&T Clean Unlock',
  priceNgn: 100_000,
  priceUsdt: 65,
  refundPolicy: 'refundable' as const,
  successRate: 82,
  turnaround: '1-7 Days',
};

describe('ImeiRemediationOffer', () => {
  it('shows a CTA only after the server returns an eligible offer', async () => {
    mockEligibility.mockResolvedValue({
      assessmentId: '22222222-2222-4222-8222-222222222222',
      kind: 'eligible',
      offers: [offer],
      usdtEnabled: true,
    });
    render(
      <ImeiRemediationOffer
        accessToken="token"
        apiBaseUrl="https://shop.example.com"
        colors={Colors.light}
        identifier="490154203237518"
        lookupId="11111111-1111-4111-8111-111111111111"
      />
    );

    expect(
      await screen.findByRole('button', { name: /unlock this device/i })
    ).toBeTruthy();
    expect(screen.getByText(/sim-locked to at&t/i)).toBeTruthy();
    expect(screen.getByText(/usually 1-7 days/i)).toBeTruthy();
  });

  it('places a USDT wallet order and opens tracking', async () => {
    mockEligibility.mockResolvedValue({
      assessmentId: '22222222-2222-4222-8222-222222222222',
      kind: 'eligible',
      offers: [offer],
      usdtEnabled: true,
    });
    mockPlace.mockResolvedValue({ kind: 'pending', status: 'submitted' });
    render(
      <ImeiRemediationOffer
        accessToken="token"
        apiBaseUrl="https://shop.example.com"
        colors={Colors.light}
        identifier="490154203237518"
        lookupId="11111111-1111-4111-8111-111111111111"
      />
    );

    fireEvent.press(
      await screen.findByRole('button', { name: /unlock this device/i })
    );
    fireEvent.press(screen.getByRole('radio', { name: /65.00 usdt/i }));
    fireEvent.press(screen.getByRole('button', { name: /confirm and pay/i }));

    await waitFor(() =>
      expect(mockPlace).toHaveBeenCalledWith(
        expect.objectContaining({ paymentCurrency: 'USDT' })
      )
    );
    fireEvent.press(
      await screen.findByRole('button', { name: /view unlock orders/i })
    );
    expect(router.push).toHaveBeenCalledWith('/unlock-orders');
  });
});
