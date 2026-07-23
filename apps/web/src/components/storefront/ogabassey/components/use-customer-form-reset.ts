'use client';

import { useState } from 'react';

interface CustomerFormReset {
  /** True on the render where `customerId` differs from the previous one. */
  customerChanged: boolean;
  /**
   * Monotonic remount token for the utility forms. Bumped only when the
   * PREVIOUS customer was defined — an account switch (A -> B) or sign-out
   * (A -> guest) — the cases where one customer's typed draft (airtime
   * phone/amount, or a bill's meter/smartcard/betting id, amount, biller and
   * the VERIFIED account-holder address) must never survive into the next
   * customer's form. A first hydration (guest -> customer, no previous
   * customer) does NOT bump it, so a guest's in-progress typing is not wiped
   * when their own auth resolves sub-second after the modal opens.
   */
  customerEpoch: number;
}

/**
 * Tracks the signed-in customer across a mounted utility modal so the forms can
 * reset when the customer changes. Both AirtimeDataForm and BillPaymentForm key
 * on `customerEpoch`, so any account switch remounts them and discards the
 * previous customer's LOCAL form state — which no prop can clear without a
 * remount. Uses the render-time "store info from previous renders" pattern (no
 * effect round-trip); it self-terminates because `prevCustomerId` is updated in
 * the same render the change is observed.
 */
export function useCustomerFormReset(
  customerId: string | undefined
): CustomerFormReset {
  const [prevCustomerId, setPrevCustomerId] = useState(customerId);
  const [customerEpoch, setCustomerEpoch] = useState(0);

  const customerChanged = customerId !== prevCustomerId;
  if (customerChanged) {
    setPrevCustomerId(customerId);
    if (prevCustomerId) {
      setCustomerEpoch((epoch) => epoch + 1);
    }
  }

  return { customerChanged, customerEpoch };
}
