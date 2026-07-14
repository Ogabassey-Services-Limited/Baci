import type { Mock } from 'vitest';

/**
 * Shared fixtures for the two `WalletFundingPanel` suites (behaviour +
 * telemetry). The `vi.mock` factories themselves stay in each suite because the
 * module registry is per-test-file; only inert data and pure helpers live here.
 */
export const walletFundingAccount = {
  accountName: 'OGB / JOHN DOE',
  accountNumber: '9012345678',
  bankName: 'Wema Bank',
  provider: 'paystack',
};

/** Narrows a `captureClientEvent` spy's calls down to a single event name. */
export function capturedEventsFor(
  captureClientEvent: Mock,
  eventName: string
): unknown[][] {
  return captureClientEvent.mock.calls.filter(
    ([event]) => event === eventName
  );
}
