import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { apiClient } from '@/lib/api-client';

interface ResolveAccountResponse {
  account_name: string;
  account_number: string;
  bank_id: number | null;
}

interface UsePayoutAccountVerificationOptions {
  accountNumber: string;
  bankCode: string;
  isAuthenticated: boolean;
}

export interface UsePayoutAccountVerificationResult {
  /** Verified account holder name, or null if not yet verified or inputs changed */
  accountName: string | null;
  /** True while the debounce is pending or a request is in-flight */
  isVerifying: boolean;
  /** Error message if resolution failed, or null */
  verifyError: string | null;
}

const DEBOUNCE_MS = 500;

/**
 * Resolves a bank account number to the holder's name.
 *
 * Uses useQuery (not useMutation) because account resolution is a read-only,
 * idempotent lookup keyed by (accountNumber, bankCode). TanStack Query handles
 * deduplication and stale-result isolation automatically.
 *
 * Stale-result isolation: any change to the raw inputs immediately clears
 * accountName and sets isVerifying=true, preventing a stale verified name
 * from authorising a save before the new lookup completes.
 */
export function usePayoutAccountVerification({
  accountNumber,
  bankCode,
  isAuthenticated,
}: UsePayoutAccountVerificationOptions): UsePayoutAccountVerificationResult {
  const debouncedAccountNumber = useDebounce(accountNumber, DEBOUNCE_MS);
  const debouncedBankCode = useDebounce(bankCode, DEBOUNCE_MS);

  // DEV-only: bypass network call for the canonical test account number
  const isDevTestAccount = __DEV__ && accountNumber === '0000000000';

  const isInputValid =
    debouncedAccountNumber.length === 10 && debouncedBankCode.length >= 2;

  // All hooks must be called unconditionally before any conditional returns.
  const { data, isLoading, error } = useQuery({
    queryKey: ['account-resolve', debouncedAccountNumber, debouncedBankCode],
    queryFn: () =>
      apiClient<ResolveAccountResponse>('/api/paystack/resolve', {
        method: 'POST',
        body: JSON.stringify({
          account_number: debouncedAccountNumber,
          bank_code: debouncedBankCode,
        }),
      }),
    enabled: isInputValid && isAuthenticated && !isDevTestAccount,
    retry: false,
    staleTime: 5 * 60 * 1000, // account names don't change mid-session
  });

  if (isDevTestAccount && isAuthenticated) {
    return {
      accountName: 'Test Account',
      isVerifying: false,
      verifyError: null,
    };
  }

  // Raw inputs differ from the debounced query key → the user is still typing.
  // Clear the result immediately so a stale name cannot authorise saving new input.
  const isPendingInput =
    accountNumber !== debouncedAccountNumber || bankCode !== debouncedBankCode;

  if (isPendingInput || !isInputValid) {
    return {
      accountName: null,
      isVerifying: isPendingInput,
      verifyError: null,
    };
  }

  return {
    accountName: data?.account_name ?? null,
    isVerifying: isLoading,
    verifyError:
      error instanceof Error
        ? error.message
        : error != null
          ? String(error)
          : null,
  };
}
