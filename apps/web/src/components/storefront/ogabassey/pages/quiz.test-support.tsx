import { vi } from 'vitest';
import { useCustomerAuth } from '@/contexts/customer-auth-context';

// Shared fixtures/helpers for the OgabasseyV2Quiz test suites, extracted so
// neither the main nor the date-of-birth-gate suite exceeds the module-size gate.

export const PRIZE_PRODUCT_ID = '55555555-5555-4555-8555-555555555555';
export const createFutureDeadline = (secondsFromNow: number) =>
  new Date(Date.now() + secondsFromNow * 1000).toISOString();

export const eventResponse = {
  events: [
    {
      endsAt: null,
      id: 'event-1',
      prizeName: 'iPhone 15 Pro Max',
      prizeProduct: {
        id: PRIZE_PRODUCT_ID,
        imageUrl: 'https://cdn.example.com/iphone-15-pro-max.png',
        name: 'iPhone 15 Pro Max',
        variantId: null,
      },
      questionCount: 1,
      startsAt: '2026-05-26T10:00:00.000Z',
      status: 'open',
      title: 'Daily Quiz',
    },
  ],
  pagination: { hasMore: false, limit: 50, nextOffset: null, offset: 0 },
};

export const attemptResponse = {
  attemptId: 'attempt-1',
  eventId: 'event-1',
  examPassPointsSpent: 1,
  question: {
    get deadlineAt() {
      return createFutureDeadline(30);
    },
    id: 'question-1',
    index: 1,
    options: [
      { id: 'a', label: 'Answer A' },
      { id: 'b', label: 'Answer B' },
    ],
    prompt: 'Pick the winning answer',
    timeLimitSeconds: 30,
    total: 1,
  },
  remainingLoyaltyPoints: 3,
};

export function mockCustomer(
  customer: { date_of_birth: string | null },
  updateCustomer = vi.fn()
) {
  vi.mocked(useCustomerAuth).mockReturnValue({
    customer: {
      email: 'shopper@example.com',
      first_name: 'Ada',
      id: 'customer-1',
      last_name: 'Lovelace',
      ...customer,
    },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
    otpState: null,
    refreshCustomer: vi.fn(),
    sendOtp: vi.fn(),
    signInWithApple: vi.fn(),
    signInWithGoogle: vi.fn(),
    updateCustomer,
    user: null,
    verifyOtp: vi.fn(),
  });
  return updateCustomer;
}
