/**
 * Decide the toast a merchant sees after confirming an order with assurance.
 *
 * `purchaseOrderInsurance` returns a request-level `success: true` even when some
 * items failed (e.g. multi-item orders where only the first device is insured),
 * so we look at the per-item `results`: a real `policyNumber` means a policy was
 * created, and any `success: false` entry is a paid-for item that was NOT
 * insured. A partial failure must still be surfaced — never masked by the first
 * policy number.
 */

export interface InsuranceConfirmationResult {
  insuranceError?: string;
  insurance?: {
    success?: boolean;
    message?: string;
    results?: Array<{
      success?: boolean;
      policyNumber?: string;
      error?: string;
      itemId?: string;
    }>;
  };
}

export interface InsuranceConfirmationToast {
  title: string;
  description: string;
  variant?: 'destructive';
}

export function summarizeInsuranceConfirmation(
  result: InsuranceConfirmationResult
): InsuranceConfirmationToast {
  const insurance = result.insurance;
  const results = insurance?.results ?? [];
  const activePolicy = results.find((item) => item.policyNumber);
  const failedItem = results.find((item) => item.success === false);
  // `purchaseOrderInsurance` can also signal a request-level failure (e.g. "no
  // items require assurance") via `insurance.success: false` with no results —
  // never report that as success.
  const requestLevelFailure =
    insurance !== undefined && insurance.success === false;
  const hasFailure =
    Boolean(result.insuranceError) ||
    Boolean(failedItem) ||
    requestLevelFailure;
  const failureMessage =
    result.insuranceError ||
    failedItem?.error ||
    insurance?.message ||
    'Insurance could not be activated';

  if (!hasFailure) {
    return {
      title: 'Order Confirmed',
      description: activePolicy
        ? `Policy Active: ${activePolicy.policyNumber}`
        : 'Order processed successfully.',
    };
  }

  if (activePolicy) {
    return {
      title: 'Order Confirmed, Insurance Partially Failed',
      variant: 'destructive',
      description: `Policy ${activePolicy.policyNumber} is active, but some items were not insured: ${failureMessage}`,
    };
  }

  return {
    title: 'Order Confirmed, Insurance Failed',
    variant: 'destructive',
    description: `Order was processed, but insurance failed: ${failureMessage}`,
  };
}
