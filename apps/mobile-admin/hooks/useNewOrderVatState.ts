import { useState } from 'react';

/**
 * VAT-applied state for the new order draft. Initializes to the merchant's VAT
 * registration and, when `autoApplyVat` is set, re-enables VAT the moment the
 * merchant's registration turns on (adjust-state-during-render pattern, so the
 * change is reflected without an extra effect/render).
 */
export function useNewOrderVatState(
  autoApplyVat: boolean,
  vatRegistrationStatus: string | null | undefined
) {
  const isVatRegistered = vatRegistrationStatus === 'registered';
  const [isVatApplied, setIsVatApplied] = useState(isVatRegistered);
  const [prevIsVatRegistered, setPrevIsVatRegistered] =
    useState(isVatRegistered);

  if (isVatRegistered !== prevIsVatRegistered) {
    setPrevIsVatRegistered(isVatRegistered);
    if (autoApplyVat && isVatRegistered) {
      setIsVatApplied(true);
    }
  }

  return { isVatApplied, isVatRegistered, setIsVatApplied };
}
