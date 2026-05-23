import { agenticActionCenterCardHelpers } from '@/components/dashboard/agentic-action-center-card-helpers';
import type { AgenticActionHealthPayload } from '@/schemas/agentic-action-health';

type AgenticCheckoutSessions = NonNullable<
  AgenticActionHealthPayload['checkout_sessions']
>;

interface AgenticCheckoutSessionsCardProps {
  checkoutSessions?: AgenticCheckoutSessions;
}

const RECENT_CHECKOUT_SESSION_LIMIT = 3;

function count(value?: number): number {
  return Math.max(0, value ?? 0);
}

function formatCount(countValue: number, singular: string, plural: string) {
  return `${countValue} ${countValue === 1 ? singular : plural}`;
}

export function AgenticCheckoutSessionsCard({
  checkoutSessions,
}: AgenticCheckoutSessionsCardProps) {
  if (!checkoutSessions) return null;

  const recentSessionRecords =
    checkoutSessions.records?.slice(0, RECENT_CHECKOUT_SESSION_LIMIT) ?? [];
  const recentCount = Math.max(
    checkoutSessions.recent_count ?? 0,
    recentSessionRecords.length
  );
  const recoveryItems = [
    formatCount(
      count(checkoutSessions.claiming_payment_count),
      'payment claim',
      'payment claims'
    ),
    formatCount(
      count(checkoutSessions.order_finalizing_count),
      'order finalization',
      'order finalizations'
    ),
    formatCount(
      count(checkoutSessions.payment_pending_count),
      'pending payment',
      'pending payments'
    ),
    formatCount(
      count(checkoutSessions.payment_setup_failed_count),
      'setup failure',
      'setup failures'
    ),
    formatCount(
      count(checkoutSessions.stale_payment_pending_count),
      'stale payment',
      'stale payments'
    ),
  ];
  const hasRecoveryActivity =
    recentSessionRecords.length > 0 ||
    [
      checkoutSessions.claiming_payment_count,
      checkoutSessions.order_finalizing_count,
      checkoutSessions.payment_pending_count,
      checkoutSessions.payment_setup_failed_count,
      checkoutSessions.stale_payment_pending_count,
    ].some((value) => count(value) > 0);

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-medium uppercase text-muted-foreground">
          Checkout session health
        </h3>
        <p className="text-xs text-muted-foreground">
          {formatCount(recentCount, 'recent session', 'recent sessions')}
        </p>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-5">
        {recoveryItems.map((item) => (
          <span className="rounded border bg-background px-2 py-1" key={item}>
            {item}
          </span>
        ))}
      </div>
      {!hasRecoveryActivity && (
        <p className="mt-3 text-xs text-muted-foreground">
          No checkout recovery activity in the current window.
        </p>
      )}
      {recentSessionRecords.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {recentSessionRecords.map((record) => (
            <li key={`${record.session_id}-${record.updated_at}`}>
              <span className="font-medium text-foreground">
                {record.session_id}
              </span>{' '}
              <span>
                moved to{' '}
                {agenticActionCenterCardHelpers.formatUnderscoreStateLabel(
                  record.payment_state
                )}
                .
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
