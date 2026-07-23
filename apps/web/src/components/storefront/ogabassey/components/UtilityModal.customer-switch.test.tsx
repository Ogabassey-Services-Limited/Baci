import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UTILITY_PENDING_INTENT_STORAGE_KEY } from './use-utility-pending-intent';
import { utilityModalTestHarness as harness } from './utility-modal-test-support';
import { UtilityModal } from './UtilityModal';

/**
 * Cross-customer isolation: when the signed-in customer changes while the modal
 * stays mounted (account switch / sign-out on a shared or persisted tab), BOTH
 * utility forms hold the typed draft in their OWN local state and read it only
 * at mount, so they must REMOUNT — no prop clears local state without one. Kept
 * separate from UtilityModal.resume.test for the 300-line modularity budget.
 */
const CUSTOMER_TWO = {
  customer: {
    id: 'customer-2',
    email: 'other@example.com',
    first_name: 'Other',
    last_name: 'Person',
    phone: '09099998888',
  },
  isAuthenticated: true,
  isLoading: false,
  user: { email: 'other@example.com', id: 'user-2', role: 'customer' },
} as const;

describe('UtilityModal customer-switch isolation', () => {
  beforeEach(() => {
    harness.reset();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    sessionStorage.clear();
  });

  it('remounts AirtimeDataForm on an account switch even when NEITHER customer has a stored intent', () => {
    // The core leak class this PR fixes: customer-1 types a LOCAL, unsaved
    // airtime draft, then customer-2 takes over the tab. With no persisted
    // intent on either side, appliedIntentKey is null before AND after, so ONLY
    // customerEpoch can force the remount that discards customer-1's local
    // phone/amount. This pins the customerEpoch term of the AirtimeDataForm key:
    // remove it and this test fails (the with-intent case alone would not,
    // because appliedIntentKey would change and mask the epoch).
    const { rerender } = render(
      <UtilityModal isOpen={true} onClose={harness.onClose} />
    );
    const before = screen.getByTestId('airtime-data-form');
    expect(before).toHaveAttribute('data-initial-amount', '');
    const instanceBefore = before.getAttribute('data-instance');

    harness.useAuth.mockReturnValue(CUSTOMER_TWO);
    rerender(<UtilityModal isOpen={true} onClose={harness.onClose} />);

    // Fresh instance — driven solely by customerEpoch (appliedIntentKey null
    // throughout), so customer-1's local draft is discarded.
    expect(
      screen.getByTestId('airtime-data-form').getAttribute('data-instance')
    ).not.toBe(instanceBefore);
  });

  it('shows customer-2 an empty airtime form after inheriting customer-1\'s open modal', () => {
    // Isolation with the resume feature ON: customer-1's stored draft prefills
    // for them, but after the switch customer-2 (who owns no intent) must see a
    // cleared form — never customer-1's 500/phone.
    vi.stubEnv('NEXT_PUBLIC_WALLET_FUNDING_CHECK_LOOP_ENABLED', 'true');
    sessionStorage.setItem(
      UTILITY_PENDING_INTENT_STORAGE_KEY,
      JSON.stringify({
        amount: '500',
        customerId: 'customer-1',
        networkProvider: 'MTN',
        phoneNumber: '08012345678',
        tab: 'airtime',
      })
    );

    const { rerender } = render(
      <UtilityModal isOpen={true} onClose={harness.onClose} />
    );
    // customer-1 sees their own resumed draft.
    expect(screen.getByTestId('airtime-data-form')).toHaveAttribute(
      'data-initial-amount',
      '500'
    );

    harness.useAuth.mockReturnValue(CUSTOMER_TWO);
    rerender(<UtilityModal isOpen={true} onClose={harness.onClose} />);

    // customer-2, who owns no stored intent, starts from an empty form.
    expect(screen.getByTestId('airtime-data-form')).toHaveAttribute(
      'data-initial-amount',
      ''
    );
  });

  it('remounts BillPaymentForm on an account switch so no meter/address draft leaks', () => {
    // Regression: BillPaymentForm keyed only on `type`, so a customer switch on
    // the same bill tab (e.g. power) never remounted it — customer-1's typed
    // meter number, amount, biller and VERIFIED account-holder ADDRESS surfaced
    // to customer-2. The modal now also keys it on `customerEpoch`.
    const { rerender } = render(
      <UtilityModal isOpen={true} initialTab="power" onClose={harness.onClose} />
    );
    const before = screen.getByTestId('bill-payment-form');
    expect(before).toHaveAttribute('data-type', 'power');
    const instanceBefore = before.getAttribute('data-instance');

    harness.useAuth.mockReturnValue(CUSTOMER_TWO);
    rerender(
      <UtilityModal isOpen={true} initialTab="power" onClose={harness.onClose} />
    );

    const after = screen.getByTestId('bill-payment-form');
    // Still on the power tab, but a fresh instance — customer-1's bill data gone.
    expect(after).toHaveAttribute('data-type', 'power');
    expect(after.getAttribute('data-instance')).not.toBe(instanceBefore);
  });

  it('does NOT remount the airtime form when a guest signs in mid-typing', () => {
    // The epoch bumps only when the PREVIOUS customer was defined, so a guest's
    // in-progress typing is not wiped when their own auth resolves (guest ->
    // customer, no prior customer to leak from).
    harness.useAuth.mockReturnValue({
      customer: null,
      isAuthenticated: false,
      isLoading: true,
      user: null,
    });
    const { rerender } = render(
      <UtilityModal isOpen={true} onClose={harness.onClose} />
    );
    const instanceBefore = screen
      .getByTestId('airtime-data-form')
      .getAttribute('data-instance');

    // Auth resolves to the (first) signed-in customer.
    harness.useAuth.mockReturnValue({
      customer: {
        id: 'customer-1',
        email: 'customer@example.com',
        first_name: 'Test',
        last_name: 'Customer',
        phone: '08012345678',
      },
      isAuthenticated: true,
      isLoading: false,
      user: { email: 'customer@example.com', id: 'user-1', role: 'customer' },
    });
    rerender(<UtilityModal isOpen={true} onClose={harness.onClose} />);

    expect(
      screen.getByTestId('airtime-data-form').getAttribute('data-instance')
    ).toBe(instanceBefore);
  });
});
