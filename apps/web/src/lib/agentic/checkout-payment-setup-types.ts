import type { SupabaseClient } from '@supabase/supabase-js';
import type { calculateCheckoutSession } from '@/lib/agentic/checkout';
import type { CheckoutCompletionAuthorization } from '@/lib/agentic/checkout-authorization';
import type {
  AgenticCheckoutBuyer,
  StoredDvaAccount,
} from '@/lib/agentic/checkout-completion-response';
import type { ClaimedCheckoutSession } from '@/lib/agentic/checkout-payment-claim';
import type { AgenticCheckoutSessionRecord } from '@/lib/agentic/checkout-session-record';
import type { AgenticMetadata } from '@/lib/agentic/checkout-storage';

export type CheckoutSessionCalculation = Awaited<
  ReturnType<typeof calculateCheckoutSession>
>;

export interface PrepareCheckoutPaymentInput {
  authorizationSecrets: string[];
  buyer: AgenticCheckoutBuyer;
  canResumePaymentAccount: boolean;
  completionAuthorization: CheckoutCompletionAuthorization | null | undefined;
  merchantId: string;
  metadata: AgenticMetadata;
  paystackSubaccountCode: string | null;
  session: AgenticCheckoutSessionRecord;
  sessionCalc: CheckoutSessionCalculation;
  sessionId: string;
  storedDvaAccount: StoredDvaAccount | null;
  supabase: SupabaseClient;
}

interface PreparedCheckoutPayment {
  dvaAccount: StoredDvaAccount;
  metadata: AgenticMetadata;
  session: AgenticCheckoutSessionRecord | ClaimedCheckoutSession;
  sessionCalc: CheckoutSessionCalculation;
}

export type PrepareCheckoutPaymentResult =
  | { ok: true; payment: PreparedCheckoutPayment }
  | {
      body: Record<string, unknown>;
      ok: false;
      status: number;
    };
