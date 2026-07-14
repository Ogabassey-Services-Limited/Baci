import type { Biller } from '@/hooks/use-vtu-billers';
import type { WalletReturnHref } from '@/lib/sanitize-wallet-return-to';
import type { BillFormProps } from './bill-form.types';
import { buildUtilityWalletReturnTo } from './build-utility-wallet-return-to';

interface BuildBillFormWalletReturnToArgs {
  billItemIdentifier: string | null;
  customerAddress: string | null;
  customerIdentifier: string;
  customerName: string | null;
  /**
   * The form's ACTUAL verified state (`canShowPayment`): the meter/smart-card
   * validated for the current selection, or an active repeat-payment session.
   * Must be passed explicitly — it cannot be inferred from `customerName`,
   * because some billers verify successfully with no customer-of-record name
   * (`VerifyResult.customerName` is optional and `canShowPayment` is keyed on
   * the verified selection, not the name). Inferring it would silently drop the
   * verified state from a legitimately verified nameless bill, sending the
   * customer back to a form whose payment section is hidden until they verify
   * all over again.
   */
  isVerified: boolean;
  numericAmount: number;
  selectedBiller: Biller | null;
  type: BillFormProps['type'];
}

/**
 * Prefilled `/utilities/<tv|power|gaming>?repeat…` deep-link the wallet returns
 * the customer to after a bank-transfer top-up. When the form was already
 * verified, the round-trip restores that verified state (`repeatVerified`) and
 * lands the customer back on a ready-to-pay form — they still re-tap Pay;
 * nothing is auto-submitted.
 */
export function buildBillFormWalletReturnTo({
  billItemIdentifier,
  customerAddress,
  customerIdentifier,
  customerName,
  isVerified,
  numericAmount,
  selectedBiller,
  type,
}: BuildBillFormWalletReturnToArgs): WalletReturnHref {
  return buildUtilityWalletReturnTo({
    amount: numericAmount,
    billItemIdentifier,
    billerName: selectedBiller?.billerName ?? null,
    customerAddress,
    customerIdentifier,
    customerName,
    type,
    verified: isVerified,
  });
}
