import {
  type CheckoutSessionRow,
  getAgenticPaymentState,
} from '@/lib/agentic/action-health-rpc-payload';
import type { AgenticActionCheckoutSessionRecord } from '@/schemas/agentic-action-health';

const CHECKOUT_ACTIVITY_RECORD_LIMIT = 5;

function toTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

export function buildAgenticCheckoutActivityRecords(
  sessionRows: CheckoutSessionRow[]
): AgenticActionCheckoutSessionRecord[] {
  return sessionRows
    .flatMap((row) => {
      const paymentState = getAgenticPaymentState(row.metadata);
      const status =
        typeof row.status === 'string' && row.status.trim().length > 0
          ? row.status.trim()
          : null;
      const sessionId =
        typeof row.session_id === 'string' ? row.session_id.trim() : '';
      if (
        !paymentState ||
        !status ||
        !sessionId ||
        !Number.isFinite(Date.parse(row.updated_at))
      ) {
        return [];
      }

      return [
        {
          payment_state: paymentState,
          session_id: sessionId,
          status,
          updated_at: row.updated_at,
        },
      ];
    })
    .sort(
      (left, right) =>
        toTimestamp(right.updated_at) - toTimestamp(left.updated_at)
    )
    .slice(0, CHECKOUT_ACTIVITY_RECORD_LIMIT);
}
