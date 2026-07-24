import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const mockDeferredAdUnit = vi.hoisted(() => vi.fn());

vi.mock('../components/deferred-ad-unit', () => ({
  DeferredAdUnit: ({
    fallback,
    placementKey,
    refreshKey,
  }: {
    fallback?: ReactNode;
    placementKey: string;
    refreshKey?: string;
  }) => {
    mockDeferredAdUnit({ placementKey, refreshKey });
    return (
      <div
        data-placement-key={placementKey}
        data-refresh-key={refreshKey}
        data-testid="quiz-question-ad"
      >
        {fallback}
      </div>
    );
  },
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
const createFutureDeadline = (secondsFromNow: number) =>
  new Date(Date.now() + secondsFromNow * 1000).toISOString();

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

describe('OgabasseyV2Quiz post-start flow', () => {
  beforeEach(() => {
    mockDeferredAdUnit.mockClear();
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refreshes the sponsored question ad when the next question appears', async () => {
    vi.mocked(apiGet).mockResolvedValue({
      ...eventResponse,
      events: [{ ...eventResponse.events[0], questionCount: 2 }],
    });
    vi.mocked(apiPost)
      .mockResolvedValueOnce({
        ...attemptResponse,
        question: { ...attemptResponse.question, total: 2 },
      })
      .mockResolvedValueOnce({
        attemptId: 'attempt-1',
        correctAnswers: 1,
        prizeEligible: false,
        question: {
          deadlineAt: createFutureDeadline(30),
          id: 'question-2',
          index: 2,
          options: [
            { id: 'a', label: 'Answer A' },
            { id: 'b', label: 'Answer B' },
          ],
          prompt: 'Pick the final answer',
          timeLimitSeconds: 30,
          total: 2,
        },
        status: 'in_progress',
        totalQuestions: 2,
      })
      .mockResolvedValueOnce({
        attemptId: 'attempt-1',
        correctAnswers: 2,
        prizeEligible: false,
        status: 'completed',
        totalQuestions: 2,
      });

    render(<OgabasseyV2Quiz merchantSlug="ogabassey" />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Start exam for Daily Quiz' })
    );

    expect(await screen.findByTestId('quiz-question-ad')).toHaveAttribute(
      'data-placement-key',
      'QUIZ_QUESTION_MPU'
    );
    expect(screen.getByTestId('quiz-question-ad')).toHaveAttribute(
      'data-refresh-key',
      'question-1'
    );
    expect(
      screen.getByLabelText('Reserved sponsored quiz placement')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Answer A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }));

    expect(await screen.findByText('Pick the final answer')).toBeInTheDocument();
    expect(screen.getByTestId('quiz-question-ad')).toHaveAttribute(
      'data-refresh-key',
      'question-2'
    );
    expect(mockDeferredAdUnit).toHaveBeenLastCalledWith({
      placementKey: 'QUIZ_QUESTION_MPU',
      refreshKey: 'question-2',
    });
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
    // Reaching the result state renders the extracted QuizResultPanel, which
    // loads the leaderboard for the event that was just played (playedEventId).
    expect(
      screen.getByRole('heading', { name: 'Leaderboard' })
    ).toBeInTheDocument();
  });
});
