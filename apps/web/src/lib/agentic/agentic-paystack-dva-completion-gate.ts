import 'server-only';

import { isAgenticPaystackDvaPaused } from './agentic-paystack-dva-paused';

export function resolveAgenticPaystackDvaCompletionGate({
  existingPaymentStateStatus,
  paymentProvider,
  paymentState,
}: {
  existingPaymentStateStatus: number | null;
  paymentProvider: string;
  paymentState: string | null;
}): 'continue' | 'reject_paused' | 'replay_existing_payment' {
  if (
    paymentState === 'payment_pending' &&
    existingPaymentStateStatus === 200
  ) {
    return 'replay_existing_payment';
  }

  if (paymentProvider === 'paystack' && isAgenticPaystackDvaPaused()) {
    return 'reject_paused';
  }

  return 'continue';
}
