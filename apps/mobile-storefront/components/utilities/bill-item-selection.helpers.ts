import type { UtilityBeneficiary } from '@/lib/utility-beneficiaries';
import type { UtilityRepeatRecipient } from '@/lib/utility-repeat';

export const BILL_ITEM_AMOUNT_FORMATTER = new Intl.NumberFormat('en-NG', {
  currency: 'NGN',
  currencyDisplay: 'narrowSymbol',
  maximumFractionDigits: 2,
  style: 'currency',
});

export function getVerifyErrorMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  return String(error);
}

export function getBillRecipientKey(
  billItemIdentifier: string | undefined,
  customerId: string | undefined
): string | null {
  const trimmedBillItemIdentifier = billItemIdentifier?.trim();
  const trimmedCustomerId = customerId?.trim();
  if (!trimmedBillItemIdentifier || !trimmedCustomerId) return null;
  return `${trimmedBillItemIdentifier}:${trimmedCustomerId}`;
}

export function getVisibleBillBeneficiaries(
  beneficiaries: UtilityBeneficiary[],
  recentRecipients: UtilityRepeatRecipient[]
): UtilityBeneficiary[] {
  const recentRecipientKeys = new Set(
    recentRecipients
      .map((recipient) =>
        getBillRecipientKey(
          recipient.defaults.billItemIdentifier,
          recipient.defaults.customerIdentifier ?? recipient.identifier
        )
      )
      .filter((key): key is string => key !== null)
  );

  return beneficiaries.filter((beneficiary) => {
    const beneficiaryKey = getBillRecipientKey(
      beneficiary.billItemIdentifier,
      beneficiary.customerId
    );
    return !beneficiaryKey || !recentRecipientKeys.has(beneficiaryKey);
  });
}
