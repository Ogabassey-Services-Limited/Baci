import { AlertCircle, Building2, Check } from 'lucide-react';
import type { MerchantBankFormSavedValues } from '@/components/merchant-bank-form';
import { MerchantBankForm } from '@/components/merchant-bank-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type MerchantSettlementDetails = {
  accountName: string | null;
  accountNumber: string | null;
  bankCode: string | null;
  bankName: string | null;
  businessName: string | null;
  countryCode: string | null;
  id: string;
  paystackSubaccountCode: string | null;
};

type MerchantSettlementCardProps = {
  hasPaystackSubaccount?: boolean;
  isPaystackSupported: boolean;
  merchant: MerchantSettlementDetails;
  onBankSaved: (savedBank: MerchantBankFormSavedValues) => void;
};

/** Shows the country-appropriate bank details form and settlement status. */
export function MerchantSettlementCard({
  hasPaystackSubaccount: savedPaystackSubaccount,
  isPaystackSupported,
  merchant,
  onBankSaved,
}: MerchantSettlementCardProps) {
  const initialData = {
    accountName: merchant.accountName ?? undefined,
    accountNumber: merchant.accountNumber ?? undefined,
    bankCode: merchant.bankCode ?? undefined,
    bankName: merchant.bankName ?? undefined,
    businessName: merchant.businessName ?? undefined,
  };

  if (!isPaystackSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-5" />
            Manual Invoice Bank Details
          </CardTitle>
          <CardDescription>
            Save bank details that appear on unpaid invoices and receipts.
            Baci-managed Paystack settlement is currently available only for
            Nigerian merchants.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MerchantBankForm
            merchantId={merchant.id}
            countryCode={merchant.countryCode}
            initialData={initialData}
            onSuccess={onBankSaved}
          />
        </CardContent>
      </Card>
    );
  }

  const hasPaystackSubaccount =
    savedPaystackSubaccount ?? Boolean(merchant.paystackSubaccountCode);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-5" />
          Bank Settlement Details
        </CardTitle>
        <CardDescription>
          Add your bank account to receive payments directly via Paystack split
          payments (T+1 settlement).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {hasPaystackSubaccount ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700">
              <Check className="size-5" />
              <div>
                <p className="font-medium">Bank Account Connected</p>
                <p className="text-sm">
                  Paystack subaccount is configured for automatic settlements
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700">
              <AlertCircle className="size-5" />
              <div>
                <p className="font-medium">Bank Account Required</p>
                <p className="text-sm">
                  Add your bank details to enable Paystack payments with
                  automatic settlement
                </p>
              </div>
            </div>
          )}
          <MerchantBankForm
            merchantId={merchant.id}
            countryCode={merchant.countryCode}
            initialData={
              hasPaystackSubaccount
                ? initialData
                : {
                    businessName: merchant.businessName ?? undefined,
                  }
            }
            onSuccess={onBankSaved}
          />
        </div>
      </CardContent>
    </Card>
  );
}
