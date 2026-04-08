import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePayoutAccountVerification } from '@/hooks/usePayoutAccountVerification';

const { mockApiClient } = vi.hoisted(() => ({
  mockApiClient: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => mockApiClient(...args),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const VALID_ACCOUNT = '0141691337';
const VALID_BANK_CODE = '058';
const ACCOUNT_NAME = 'John Doe';

const RESOLVED_RESPONSE = {
  account_name: ACCOUNT_NAME,
  account_number: VALID_ACCOUNT,
  bank_id: null,
};

describe('usePayoutAccountVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper: advance all timers AND flush pending promises in one step.
  // Using vi.runAllTimersAsync() avoids the timing issues that arise when
  // combining vi.advanceTimersByTime() with waitFor(), because waitFor()
  // itself polls via setTimeout which never fires under fake timers.
  async function settle() {
    await act(async () => {
      await vi.runAllTimersAsync();
    });
  }

  it('query is disabled when account number is fewer than 10 digits', async () => {
    const { result } = renderHook(
      () =>
        usePayoutAccountVerification({
          accountNumber: '012345',
          bankCode: VALID_BANK_CODE,
          isAuthenticated: true,
        }),
      { wrapper: createWrapper() }
    );

    await settle();

    expect(mockApiClient).not.toHaveBeenCalled();
    expect(result.current.accountName).toBeNull();
    expect(result.current.isVerifying).toBe(false);
  });

  it('query is disabled when bankCode is empty', async () => {
    const { result } = renderHook(
      () =>
        usePayoutAccountVerification({
          accountNumber: VALID_ACCOUNT,
          bankCode: '',
          isAuthenticated: true,
        }),
      { wrapper: createWrapper() }
    );

    await settle();

    expect(mockApiClient).not.toHaveBeenCalled();
    expect(result.current.accountName).toBeNull();
  });

  it('query is disabled when not authenticated', async () => {
    renderHook(
      () =>
        usePayoutAccountVerification({
          accountNumber: VALID_ACCOUNT,
          bankCode: VALID_BANK_CODE,
          isAuthenticated: false,
        }),
      { wrapper: createWrapper() }
    );

    await settle();

    expect(mockApiClient).not.toHaveBeenCalled();
  });

  it('returns isVerifying=true while debounce is pending (no timers advanced)', () => {
    const { result } = renderHook(
      () =>
        usePayoutAccountVerification({
          accountNumber: VALID_ACCOUNT,
          bankCode: VALID_BANK_CODE,
          isAuthenticated: true,
        }),
      { wrapper: createWrapper() }
    );

    // Debounce has not settled — isPendingInput=true
    expect(result.current.isVerifying).toBe(true);
    expect(result.current.accountName).toBeNull();
  });

  it('fires exactly one request after debounce settles', async () => {
    mockApiClient.mockResolvedValue(RESOLVED_RESPONSE);

    renderHook(
      () =>
        usePayoutAccountVerification({
          accountNumber: VALID_ACCOUNT,
          bankCode: VALID_BANK_CODE,
          isAuthenticated: true,
        }),
      { wrapper: createWrapper() }
    );

    await settle();

    expect(mockApiClient).toHaveBeenCalledTimes(1);
    expect(mockApiClient).toHaveBeenCalledWith(
      '/api/paystack/resolve',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('does not re-fire after a successful response (no loop)', async () => {
    mockApiClient.mockResolvedValue(RESOLVED_RESPONSE);

    renderHook(
      () =>
        usePayoutAccountVerification({
          accountNumber: VALID_ACCOUNT,
          bankCode: VALID_BANK_CODE,
          isAuthenticated: true,
        }),
      { wrapper: createWrapper() }
    );

    await settle();
    // Settle again to confirm no additional calls were queued
    await settle();

    expect(mockApiClient).toHaveBeenCalledTimes(1);
  });

  it('returns accountName on success', async () => {
    mockApiClient.mockResolvedValue(RESOLVED_RESPONSE);

    const { result } = renderHook(
      () =>
        usePayoutAccountVerification({
          accountNumber: VALID_ACCOUNT,
          bankCode: VALID_BANK_CODE,
          isAuthenticated: true,
        }),
      { wrapper: createWrapper() }
    );

    await settle();

    expect(result.current.accountName).toBe(ACCOUNT_NAME);
    expect(result.current.isVerifying).toBe(false);
    expect(result.current.verifyError).toBeNull();
  });

  it('returns verifyError on failure', async () => {
    mockApiClient.mockRejectedValue(new Error('Account not found'));

    const { result } = renderHook(
      () =>
        usePayoutAccountVerification({
          accountNumber: VALID_ACCOUNT,
          bankCode: VALID_BANK_CODE,
          isAuthenticated: true,
        }),
      { wrapper: createWrapper() }
    );

    await settle();

    expect(result.current.verifyError).toBe('Account not found');
    expect(result.current.accountName).toBeNull();
    expect(result.current.isVerifying).toBe(false);
  });

  it('clears accountName immediately when accountNumber changes before debounce settles', async () => {
    mockApiClient.mockResolvedValue(RESOLVED_RESPONSE);

    const { result, rerender } = renderHook(
      ({ accountNumber }: { accountNumber: string }) =>
        usePayoutAccountVerification({
          accountNumber,
          bankCode: VALID_BANK_CODE,
          isAuthenticated: true,
        }),
      {
        wrapper: createWrapper(),
        initialProps: { accountNumber: VALID_ACCOUNT },
      }
    );

    // Let the first verification complete fully
    await settle();
    expect(result.current.accountName).toBe(ACCOUNT_NAME);

    // User edits the account number — debounce has NOT advanced after rerender
    act(() => {
      rerender({ accountNumber: '9876543210' });
    });

    // Must clear immediately without waiting for debounce
    expect(result.current.accountName).toBeNull();
    expect(result.current.isVerifying).toBe(true);
  });

  it('clears accountName immediately when bankCode changes before debounce settles', async () => {
    mockApiClient.mockResolvedValue(RESOLVED_RESPONSE);

    const { result, rerender } = renderHook(
      ({ bankCode }: { bankCode: string }) =>
        usePayoutAccountVerification({
          accountNumber: VALID_ACCOUNT,
          bankCode,
          isAuthenticated: true,
        }),
      { wrapper: createWrapper(), initialProps: { bankCode: VALID_BANK_CODE } }
    );

    await settle();
    expect(result.current.accountName).toBe(ACCOUNT_NAME);

    // User selects a different bank
    act(() => {
      rerender({ bankCode: '044' });
    });

    expect(result.current.accountName).toBeNull();
    expect(result.current.isVerifying).toBe(true);
  });
});
