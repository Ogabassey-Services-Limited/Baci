import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import { apiGet, apiPost } from '@/lib/api-client';
import { OgabasseyV2Quiz } from './quiz';
import { attemptResponse, eventResponse } from './quiz.test-support';

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


describe('OgabasseyV2Quiz', () => {
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

  it('shows the live per-question countdown once the exam starts (FIX A)', async () => {
    vi.mocked(apiGet).mockResolvedValue(eventResponse);
    vi.mocked(apiPost).mockResolvedValueOnce(attemptResponse);

    render(<OgabasseyV2Quiz merchantSlug="ogabassey" />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Start exam for Daily Quiz' })
    );

    expect(await screen.findByText('30s remaining')).toBeInTheDocument();
  });

  it('keeps a failed timeout submission retryable', async () => {
    vi.useFakeTimers({ now: new Date('2026-05-26T10:00:00.000Z') });
    vi.mocked(apiGet).mockResolvedValue(eventResponse);
    vi.mocked(apiPost)
      .mockResolvedValueOnce({
        ...attemptResponse,
        question: {
          ...attemptResponse.question,
          deadlineAt: new Date(Date.now() + 100).toISOString(),
        },
      })
      .mockRejectedValueOnce(new Error('temporary network failure'))
      .mockResolvedValueOnce({
        attemptId: 'attempt-1',
        correctAnswers: 0,
        prizeEligible: false,
        status: 'completed',
        totalQuestions: 1,
    });

    render(<OgabasseyV2Quiz merchantSlug="ogabassey" />);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Start exam for Daily Quiz' })
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Pick the winning answer')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
      await Promise.resolve();
    });
    expect(apiPost).toHaveBeenCalledTimes(2);

    const retryButton = screen.getByRole('button', {
      name: 'Submit answer',
    });
    expect(retryButton).toBeEnabled();
    fireEvent.click(retryButton);

    await act(async () => {
      await Promise.resolve();
    });
    expect(apiPost).toHaveBeenLastCalledWith(
      '/api/quiz/attempts/attempt-1/answers',
      expect.objectContaining({
        answer: '__baci_quiz_timeout_forfeit_no_answer__',
        integrityTier: 'basic',
        questionId: 'question-1',
      })
    );
  });

  it('guards against double-tapping Start firing two attempts (FIX D)', async () => {
    vi.mocked(apiGet).mockResolvedValue(eventResponse);
    vi.mocked(apiPost).mockResolvedValueOnce(attemptResponse);

    render(<OgabasseyV2Quiz merchantSlug="ogabassey" />);
    const startButton = await screen.findByRole('button', {
      name: 'Start exam for Daily Quiz',
    });

    // Two synchronous taps before the async start resolves.
    fireEvent.click(startButton);
    fireEvent.click(startButton);

    expect(
      await screen.findByText('Pick the winning answer')
    ).toBeInTheDocument();
    // The synchronous in-flight ref must have swallowed the second tap.
    expect(apiPost).toHaveBeenCalledTimes(1);
  });
});
