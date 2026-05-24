import type { AgenticActionHealthPayload } from '@/schemas/agentic-action-health';

export interface AgenticActionHealthSummary {
  actions: {
    attention_count: number;
    monitor_count: number;
    ok_count: number;
    total_count: number;
  };
  checkout_sessions?: {
    claiming_payment_count?: number;
    order_finalizing_count?: number;
    payment_pending_count?: number;
    payment_setup_failed_count?: number;
    recent_count?: number;
    stale_payment_pending_count?: number;
  };
  generated_at?: string;
  idempotency?: {
    active_in_progress_count?: number;
    in_progress_count?: number;
    recent_count?: number;
    stale_in_progress_count?: number;
    terminal_error_count?: number;
  };
  request_controls?: AgenticActionHealthPayload['request_controls'];
  requests?: {
    recent_count?: number;
  };
}

export function summarizeAgenticActionHealth(
  health: AgenticActionHealthPayload
): AgenticActionHealthSummary {
  const actionCounts = health.actions.reduce(
    (counts, action) => {
      counts.total_count += 1;
      if (action.severity === 'attention') counts.attention_count += 1;
      if (action.severity === 'monitor') counts.monitor_count += 1;
      if (action.severity === 'ok') counts.ok_count += 1;
      return counts;
    },
    { attention_count: 0, monitor_count: 0, ok_count: 0, total_count: 0 }
  );

  return {
    actions: actionCounts,
    checkout_sessions: health.checkout_sessions
      ? {
          claiming_payment_count:
            health.checkout_sessions.claiming_payment_count,
          order_finalizing_count:
            health.checkout_sessions.order_finalizing_count,
          payment_pending_count: health.checkout_sessions.payment_pending_count,
          payment_setup_failed_count:
            health.checkout_sessions.payment_setup_failed_count,
          recent_count: health.checkout_sessions.recent_count,
          stale_payment_pending_count:
            health.checkout_sessions.stale_payment_pending_count,
        }
      : undefined,
    generated_at: health.generated_at,
    idempotency: health.idempotency
      ? {
          active_in_progress_count: health.idempotency.active_in_progress_count,
          in_progress_count: health.idempotency.in_progress_count,
          recent_count: health.idempotency.recent_count,
          stale_in_progress_count: health.idempotency.stale_in_progress_count,
          terminal_error_count: health.idempotency.terminal_error_count,
        }
      : undefined,
    request_controls: health.request_controls,
    requests: health.requests
      ? {
          recent_count: health.requests.recent_count,
        }
      : undefined,
  };
}
