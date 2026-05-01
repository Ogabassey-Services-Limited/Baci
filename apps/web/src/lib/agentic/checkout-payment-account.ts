import type { AgenticCheckoutBuyer } from '@/lib/agentic/checkout-completion-response';
import {
  createDedicatedVirtualAccount,
  type DVAResponse,
} from '@/lib/agentic/paystack';

type CreateCheckoutPaymentAccountResult =
  | {
      account: DVAResponse;
      ok: true;
    }
  | {
      error: unknown;
      errorMessage: string;
      ok: false;
    };

export async function createAgenticCheckoutPaymentAccount({
  buyer,
  paystackSubaccountCode,
}: {
  buyer: AgenticCheckoutBuyer;
  paystackSubaccountCode: string | null | undefined;
}): Promise<CreateCheckoutPaymentAccountResult> {
  const normalizedSubaccountCode =
    typeof paystackSubaccountCode === 'string'
      ? paystackSubaccountCode.trim()
      : '';
  if (!normalizedSubaccountCode) {
    return {
      error: new Error('Merchant Paystack subaccount is not configured'),
      errorMessage: 'Merchant Paystack subaccount is not configured',
      ok: false,
    };
  }

  try {
    const account = await createDedicatedVirtualAccount(
      {
        email: buyer.email,
        first_name: buyer.first_name,
        last_name: buyer.last_name,
        phone: buyer.phone_number,
      },
      { subaccount: normalizedSubaccountCode }
    );

    return {
      account,
      ok: true,
    };
  } catch (error: unknown) {
    return {
      error,
      errorMessage:
        error instanceof Error
          ? error.message
          : 'Failed to create payment account',
      ok: false,
    };
  }
}
