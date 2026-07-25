import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import { apiGet, apiPost } from '@/lib/api-client';
import { OgabasseyV2Quiz } from './quiz';
import { attemptResponse, eventResponse, mockCustomer } from './quiz.test-support';

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


describe('OgabasseyV2Quiz date-of-birth gate', () => {
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


  it('opens the 18+ age gate instead of starting when the customer has no date of birth', async () => {
    mockCustomer({ date_of_birth: null });
    vi.mocked(apiGet).mockResolvedValue(eventResponse);

    render(<OgabasseyV2Quiz merchantSlug="ogabassey" />);

    fireEvent.click(
      await screen.findByRole('button', { name: /start exam/i })
    );

    expect(
      await screen.findByRole('dialog', { name: 'Confirm your date of birth' })
    ).toBeInTheDocument();
    // The attempt must NOT be started until a DOB is provided.
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('saves the date of birth then starts the exam', async () => {
    const updateCustomer = mockCustomer(
      { date_of_birth: null },
      vi.fn().mockResolvedValue({ success: true })
    );
    vi.mocked(apiGet).mockResolvedValue(eventResponse);
    vi.mocked(apiPost).mockResolvedValueOnce(attemptResponse);

    render(<OgabasseyV2Quiz merchantSlug="ogabassey" />);

    fireEvent.click(
      await screen.findByRole('button', { name: /start exam/i })
    );
    fireEvent.change(await screen.findByLabelText('Date of birth'), {
      target: { value: '1990-06-15' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(updateCustomer).toHaveBeenCalledWith({
      date_of_birth: '1990-06-15',
    });
    // The attempt starts once the DOB is saved.
    expect(await screen.findByText('Pick the winning answer')).toBeInTheDocument();
  });

  it('keeps the gate open with the error when saving the date of birth fails', async () => {
    const updateCustomer = mockCustomer(
      { date_of_birth: null },
      vi.fn().mockResolvedValue({
        success: false,
        error: 'Could not save your date of birth.',
      })
    );
    vi.mocked(apiGet).mockResolvedValue(eventResponse);

    render(<OgabasseyV2Quiz merchantSlug="ogabassey" />);

    fireEvent.click(
      await screen.findByRole('button', { name: /start exam/i })
    );
    fireEvent.change(await screen.findByLabelText('Date of birth'), {
      target: { value: '1990-06-15' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(updateCustomer).toHaveBeenCalledWith({
      date_of_birth: '1990-06-15',
    });
    // The persistence error is surfaced and the gate stays open so the shopper
    // can retry — a failed save must not strand them.
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not save your date of birth.'
    );
    expect(
      screen.getByRole('dialog', { name: 'Confirm your date of birth' })
    ).toBeInTheDocument();
    // The attempt is never started when the DOB failed to persist.
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('starts directly when the customer already has a date of birth', async () => {
    mockCustomer({ date_of_birth: '1990-06-15' });
    vi.mocked(apiGet).mockResolvedValue(eventResponse);
    vi.mocked(apiPost).mockResolvedValueOnce(attemptResponse);

    render(<OgabasseyV2Quiz merchantSlug="ogabassey" />);

    fireEvent.click(
      await screen.findByRole('button', { name: /start exam/i })
    );

    expect(await screen.findByText('Pick the winning answer')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
    fireEvent.click(
      await screen.findByRole('button', { name: /start exam/i })
    );

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
      expect(screen.queryByText('Pick the winning answer')).not.toBeInTheDocument()
    );
    expect(
      await screen.findByRole('button', { name: /start exam/i })
    ).toBeInTheDocument();
  });

  it('reopens the age gate when a stored date of birth fails the server 18+ check', async () => {
    // The shopper already has a DOB on file (e.g. mistyped earlier), so the
    // start goes straight to the server, which rejects it as under-18. There is
    // no other DOB editor, so the gate must reopen with the reason.
    mockCustomer({ date_of_birth: '2015-06-15' });
    vi.mocked(apiGet).mockResolvedValue(eventResponse);
    vi.mocked(apiPost).mockRejectedValueOnce(
      new Error('Quiz participation requires an adult profile (18+)')
    );

    render(<OgabasseyV2Quiz merchantSlug="ogabassey" />);

    fireEvent.click(
      await screen.findByRole('button', { name: /start exam/i })
    );

    // The correction gate reopens, seeded with the rejection reason.
    expect(
      await screen.findByRole('dialog', { name: 'Confirm your date of birth' })
    ).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Quiz participation requires an adult profile (18+)'
    );
  });

  it('does not start two attempts when Continue is double-submitted', async () => {
    let resolveSave: (value: { success: boolean }) => void = () => {};
    const savePromise = new Promise<{ success: boolean }>((resolve) => {
      resolveSave = resolve;
    });
    const updateCustomer = mockCustomer(
      { date_of_birth: null },
      vi.fn().mockReturnValue(savePromise)
    );
    vi.mocked(apiGet).mockResolvedValue(eventResponse);
    vi.mocked(apiPost).mockResolvedValueOnce(attemptResponse);

    render(<OgabasseyV2Quiz merchantSlug="ogabassey" />);
    fireEvent.click(
      await screen.findByRole('button', { name: /start exam/i })
    );
    fireEvent.change(await screen.findByLabelText('Date of birth'), {
      target: { value: '1990-06-15' },
    });

    // Two synchronous submits before the pending save resolves — the
    // synchronous in-flight guard must swallow the second.
    const dialog = screen.getByRole('dialog');
    fireEvent.submit(dialog);
    fireEvent.submit(dialog);

    resolveSave({ success: true });
    expect(
      await screen.findByText('Pick the winning answer')
    ).toBeInTheDocument();

    expect(updateCustomer).toHaveBeenCalledTimes(1);
    expect(apiPost).toHaveBeenCalledTimes(1);
  });

  it('keeps the gate open with the error when the start is rejected after saving DOB', async () => {
    mockCustomer(
      { date_of_birth: null },
      vi.fn().mockResolvedValue({ success: true })
    );
    vi.mocked(apiGet).mockResolvedValue(eventResponse);
    // The save succeeds but the server rejects the start (e.g. under-18).
    vi.mocked(apiPost).mockRejectedValueOnce(
      new Error('Quiz participation requires an adult profile (18+)')
    );

    render(<OgabasseyV2Quiz merchantSlug="ogabassey" />);
    fireEvent.click(
      await screen.findByRole('button', { name: /start exam/i })
    );
    fireEvent.change(await screen.findByLabelText('Date of birth'), {
      target: { value: '2020-06-15' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // The gate stays open so the shopper can correct their DOB — not stranded.
    expect(
      await screen.findByRole('dialog', { name: 'Confirm your date of birth' })
    ).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Quiz participation requires an adult profile (18+)'
    );
  });
});
