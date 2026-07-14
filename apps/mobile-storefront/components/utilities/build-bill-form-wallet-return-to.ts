import type { Biller } from '@/hooks/use-vtu-billers';
import type { WalletReturnHref } from '@/lib/sanitize-wallet-return-to';
import type { BillFormProps } from './bill-form.types';
import { buildUtilityWalletReturnTo } from './build-utility-wallet-return-to';

interface BuildBillFormWalletReturnToArgs {
  billItemIdentifier: string | null;
  customerAddress: string | null;
  customerIdentifier: string;
  customerName: string | null;
  numericAmount: number;
  selectedBiller: Biller | null;
  type: BillFormProps['type'];
}

/**
 * Prefilled `/utilities/<tv|power|gaming>?repeat…` deep-link the wallet returns
 * the customer to after a bank-transfer top-up. A verified customer-of-record
 * name means the meter/smart-card was already validated, so the round-trip can
 * restore the verified state (`repeatVerified`) and land the customer back on a
 * ready-to-pay form — they still re-tap Pay; nothing is auto-submitted.
 */
export function buildBillFormWalletReturnTo({
  billItemIdentifier,
  customerAddress,
  customerIdentifier,
  customerName,
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
    verified: Boolean(customerName),
  });
}
