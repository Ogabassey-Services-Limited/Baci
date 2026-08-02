import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
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

// The mid-start account-switch integration case lives here (split from
// quiz.dob-gate.test.tsx) so each suite stays under the 300-line module limit.
describe('OgabasseyV2Quiz date-of-birth gate — account switches', () => {
  beforeEach(() => {
    mockDeferredAdUnit.mockClear();
    vi.mocked(apiGet).mockReset();
    vi.mocked(apiPost).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render the previous shopper’s attempt when the account switches mid-start', async () => {
    // Regression (is6TyY8Q): runStart commits the attempt into page state AFTER
    // its await. If the account switches while the start request is in flight,
    // the new session must not be shown the previous shopper's question.
    const baseAuth = {
      customer: {
        email: 'a@example.com',
        first_name: 'Ada',
        id: 'customer-a',
        last_name: 'Lovelace',
        date_of_birth: '1990-06-15',
      },
      isAuthenticated: true as const,
      isLoading: false,
      logout: vi.fn(),
      otpState: null,
      refreshCustomer: vi.fn(),
      sendOtp: vi.fn(),
      signInWithApple: vi.fn(),
      signInWithGoogle: vi.fn(),
      updateCustomer: vi.fn(),
      verifyOtp: vi.fn(),
    };
    vi.mocked(useCustomerAuth).mockReturnValue({
      ...baseAuth,
      user: { id: 'user-a', email: 'a@example.com', role: 'customer' },
    });
    vi.mocked(apiGet).mockResolvedValue(eventResponse);
    let resolveStart: (value: unknown) => void = () => {};
    vi.mocked(apiPost).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveStart = resolve;
      })
    );

    const { rerender } = render(<OgabasseyV2Quiz merchantSlug="ogabassey" />);
    fireEvent.click(await screen.findByRole('button', { name: /start exam/i }));

    // Account switches to shopper B while the attempt request is in flight.
    vi.mocked(useCustomerAuth).mockReturnValue({
      ...baseAuth,
      customer: { ...baseAuth.customer, id: 'customer-b' },
      user: { id: 'user-b', email: 'b@example.com', role: 'customer' },
    });
    rerender(<OgabasseyV2Quiz merchantSlug="ogabassey" />);

    // Shopper A's start resolves after the switch.
    await act(async () => {
      resolveStart(attemptResponse);
    });

    // B is not shown A's question, and the event list (Start) is restored.
    await waitFor(() =>
      expect(
        screen.queryByText('Pick the winning answer')
      ).not.toBeInTheDocument()
    );
    expect(
      await screen.findByRole('button', { name: /start exam/i })
    ).toBeInTheDocument();
  });
});
