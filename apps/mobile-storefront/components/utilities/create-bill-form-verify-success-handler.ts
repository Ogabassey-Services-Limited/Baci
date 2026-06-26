import type { Biller } from '@/hooks/use-vtu-billers';
import type { VerifyResult } from '@/hooks/use-vtu-verify';
import type { BillFormBeneficiarySaveRequest } from './use-bill-form-beneficiaries';

interface CreateBillFormVerifySuccessHandlerInput {
  authenticatedCustomerId: string | null;
  normalizedCustomerId: string;
  pendingVerificationKeyRef: { current: string | null };
  selectedBiller: Biller | null;
  selectedBillItemIdentifier: string | null | undefined;
  setBeneficiarySaveRequest: (
    request: BillFormBeneficiarySaveRequest | null
  ) => void;
  setVerifiedCustomerAddress: (value: string | null) => void;
  setVerifiedCustomerName: (value: string | null) => void;
  setVerifiedRequireValidationRef: (value: boolean | undefined) => void;
  setVerifiedSelectionKey: (value: string | null) => void;
  setVerifiedValidationReference: (value: string | null) => void;
}

/**
 * Builds the verify mutation's onSuccess callback (event time) instead of an
 * effect that mirrors verify.data into state. resetVerification nulls
 * pendingVerificationKeyRef on any selection/identifier change, so a stale
 * response can never apply to inputs that changed mid-flight.
 */
export function createBillFormVerifySuccessHandler({
  authenticatedCustomerId,
  normalizedCustomerId,
  pendingVerificationKeyRef,
  selectedBiller,
  selectedBillItemIdentifier,
  setBeneficiarySaveRequest,
  setVerifiedCustomerAddress,
  setVerifiedCustomerName,
  setVerifiedRequireValidationRef,
  setVerifiedSelectionKey,
  setVerifiedValidationReference,
}: CreateBillFormVerifySuccessHandlerInput) {
  return (data: VerifyResult) => {
    if (!(data.verified && pendingVerificationKeyRef.current)) {
      return;
    }
    setVerifiedSelectionKey(pendingVerificationKeyRef.current);
    pendingVerificationKeyRef.current = null;
    const customerName = data.customerName?.trim() || null;
    setVerifiedCustomerName(customerName);
    setVerifiedCustomerAddress(data.address?.trim() || null);
    setVerifiedValidationReference(data.validationReference?.trim() || null);
    setVerifiedRequireValidationRef(data.requireValidationRef);

    const biller = selectedBiller;
    const billItemId = selectedBillItemIdentifier;
    if (!(biller && billItemId && customerName)) {
      setBeneficiarySaveRequest(null);
      return;
    }
    setBeneficiarySaveRequest({
      authenticatedCustomerId,
      billerId: biller.billerId,
      billerName: biller.billerName,
      billItemIdentifier: billItemId,
      customerId: normalizedCustomerId,
      customerName,
    });
  };
}
