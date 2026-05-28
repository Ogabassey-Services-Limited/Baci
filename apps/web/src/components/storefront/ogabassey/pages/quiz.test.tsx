import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import { apiGet, apiPost } from '@/lib/api-client';
import { OgabasseyV2Quiz } from './quiz';

vi.mock('@/contexts/customer-auth-context', () => ({
  useCustomerAuth: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/ogabassey/quiz',
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    className,
    href,
  }: {
    children: ReactNode;
    className?: string;
    href: string;
  }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
}));

const PRIZE_PRODUCT_ID = '55555555-5555-4555-8555-555555555555';
const PRIZE_AWARD_ID = '44444444-4444-4444-8444-444444444444';

const eventResponse = {
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

const attemptResponse = {
  attemptId: 'attempt-1',
  eventId: 'event-1',
  examPassPointsSpent: 1,
  question: {
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

describe('OgabasseyV2Quiz', () => {
  beforeEach(() => {
    vi.mocked(apiGet).mockReset();
    vi.mocked(apiPost).mockReset();
    vi.mocked(useCustomerAuth).mockReturnValue({
      customer: null,
      isAuthenticated: true,
      isLoading: false,
      logout: vi.fn(),
      otpState: null,
      refreshCustomer: vi.fn(),
      sendOtp: vi.fn(),
      signInWithApple: vi.fn(),
      signInWithGoogle: vi.fn(),
      updateCustomer: vi.fn(),
      user: null,
      verifyOtp: vi.fn(),
    });
  });

  it('links unauthenticated customers to login with quiz redirect', () => {
    vi.mocked(useCustomerAuth).mockReturnValue({
      customer: null,
      isAuthenticated: false,
      isLoading: false,
      logout: vi.fn(),
      otpState: null,
      refreshCustomer: vi.fn(),
      sendOtp: vi.fn(),
      signInWithApple: vi.fn(),
      signInWithGoogle: vi.fn(),
      updateCustomer: vi.fn(),
      user: null,
      verifyOtp: vi.fn(),
    });

    render(<OgabasseyV2Quiz merchantSlug="ogabassey" />);

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/ogabassey/account/login?redirect=%2Fogabassey%2Fquiz'
    );
    expect(apiGet).not.toHaveBeenCalled();
  });

  it('loads events, starts an exam, and submits an answer', async () => {
    vi.mocked(apiGet).mockResolvedValue(eventResponse);
    vi.mocked(apiPost)
      .mockResolvedValueOnce(attemptResponse)
      .mockResolvedValueOnce({
        attemptId: 'attempt-1',
        correctAnswers: 1,
        prizeEligible: false,
        status: 'completed',
        totalQuestions: 1,
      });

    render(<OgabasseyV2Quiz merchantSlug="ogabassey" />);

    expect(await screen.findByText('Daily Quiz')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start exam for Daily Quiz' }));

    expect(await screen.findByText('Pick the winning answer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Answer A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }));

    await waitFor(() => {
      expect(apiPost).toHaveBeenLastCalledWith(
        '/api/quiz/attempts/attempt-1/answers',
        expect.objectContaining({
          answer: 'a',
          integrityTier: 'basic',
          questionId: 'question-1',
        })
      );
    });
    expect(await screen.findByText('1 of 1')).toBeInTheDocument();
  });

  it('links eligible prize winners to add the device gift to cart', async () => {
    vi.mocked(apiGet).mockResolvedValue(eventResponse);
    vi.mocked(apiPost)
      .mockResolvedValueOnce(attemptResponse)
      .mockResolvedValueOnce({
        attemptId: 'attempt-1',
        correctAnswers: 1,
        prizeClaim: {
          awardId: PRIZE_AWARD_ID,
          cartPath:
            `/ogabassey/cart?item_id=${PRIZE_PRODUCT_ID}&quiz_award_id=${PRIZE_AWARD_ID}&quiz_voucher_token=signed-token`,
          condition: null,
          productId: PRIZE_PRODUCT_ID,
          variantId: null,
          voucherToken: 'signed-token',
        },
        prizeEligible: true,
        status: 'completed',
        totalQuestions: 1,
      });

    render(<OgabasseyV2Quiz merchantSlug="ogabassey" />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Start exam for Daily Quiz' })
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Answer A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }));

    expect(await screen.findByText('Prize entry recorded.')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /add gift to cart/i })
    ).toHaveAttribute(
      'href',
      `/ogabassey/cart?item_id=${PRIZE_PRODUCT_ID}&quiz_award_id=${PRIZE_AWARD_ID}&quiz_voucher_token=signed-token`
    );
  });
});
