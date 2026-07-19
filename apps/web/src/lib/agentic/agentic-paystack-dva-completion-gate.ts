import 'server-only';

import { isAgenticPaystackDvaPaused } from './agentic-paystack-dva-paused';

export function resolveAgenticPaystackDvaCompletionGate({
  paymentProvider,
}: {
  paymentProvider: string;
}): 'continue' | 'reject_paused' {
  if (paymentProvider === 'paystack' && isAgenticPaystackDvaPaused()) {
    return 'reject_paused';
  }

  return 'continue';
}
