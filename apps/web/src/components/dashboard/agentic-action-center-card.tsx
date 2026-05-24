'use client';

import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { agenticActionCenterCardHelpers } from '@/components/dashboard/agentic-action-center-card-helpers';
import { AgenticRecentSignedRequestsCard } from '@/components/dashboard/agentic-recent-signed-requests-card';
import { AgenticRequestControlsCard } from '@/components/dashboard/agentic-request-controls-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type {
  AgenticActionHealthPayload,
  AgenticActionSeverity,
} from '@/schemas/agentic-action-health';

type AgenticActionCenterState = 'ready' | 'error' | 'unauthorized';

interface AgenticActionCenterCardProps {
  payload?: AgenticActionHealthPayload | null;
  state?: AgenticActionCenterState;
}

function getActionTone(severity: AgenticActionSeverity) {
  switch (severity) {
    case 'attention':
      return {
        className:
          'border-red-200 bg-red-50/70 text-red-950 dark:border-red-900 dark:bg-red-950/20 dark:text-red-100',
        icon: AlertTriangle,
        label: 'Needs attention',
      };
    case 'monitor':
      return {
        className:
          'border-amber-200 bg-amber-50/70 text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100',
        icon: Clock3,
        label: 'Monitor',
      };
    default:
      return {
        className:
          'border-green-200 bg-green-50/70 text-green-950 dark:border-green-900 dark:bg-green-950/20 dark:text-green-100',
        icon: CheckCircle2,
        label: 'Healthy',
      };
  }
}

function formatPaymentStateLabel(paymentState: string): string {
  return paymentState
    .split('_')
    .filter((token) => token.length > 0)
    .map((token) => token[0]?.toUpperCase() + token.slice(1))
    .join(' ');
}

function formatIdempotencyStateLabel(state: string): string {
  return state
    .split('_')
    .filter((token) => token.length > 0)
    .map((token) => token[0]?.toUpperCase() + token.slice(1))
    .join(' ');
}

export function AgenticActionCenterCard({
  payload = null,
  state = 'error',
}: AgenticActionCenterCardProps) {
  if (state === 'unauthorized') return null;

  const failed = state === 'error';
  if (!payload && !failed) return null;

  const actions = payload?.actions ?? [];
  const briefing =
    agenticActionCenterCardHelpers.buildAgenticDashboardBriefing(actions);
  const attentionCount = briefing.attentionCount;
  const monitorCount = briefing.monitorCount;
  const generatedAt = agenticActionCenterCardHelpers.formatGeneratedAt(
    payload?.generated_at
  );
  const recentSessionRecords =
    payload?.checkout_sessions?.records?.slice(0, 3) ?? [];
  const idempotencyPressureRecords =
    payload?.idempotency?.records
      ?.filter(
        (record) =>
          record.state === 'in_progress' || record.state === 'server_error'
      )
      .slice(0, 3) ?? [];
  const requestControls = payload?.request_controls;
  const recentRequestRecords = payload?.requests?.records?.slice(0, 3) ?? [];
  const recentRequestCount =
    payload?.requests?.recent_count ?? recentRequestRecords.length;
  const statusDescription = failed
    ? 'Agentic checkout health could not be loaded.'
    : attentionCount > 0
      ? 'Agentic checkout issues need review before buyers retry.'
      : monitorCount > 0
        ? 'Agentic checkout activity is active and should be monitored.'
        : 'Agentic checkout activity is stable right now.';
  const badgeLabel = failed
    ? 'Unavailable'
    : attentionCount > 0
      ? `${attentionCount} open`
      : monitorCount > 0
        ? `${monitorCount} monitor`
        : 'Clear';

  return (
    <Card className="border-border/70">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-5 w-5 text-primary" />
              Agent action center
            </CardTitle>
            <CardDescription>{statusDescription}</CardDescription>
          </div>
          <Badge
            variant={
              failed
                ? 'outline'
                : attentionCount > 0
                  ? 'destructive'
                  : monitorCount > 0
                    ? 'outline'
                    : 'secondary'
            }
          >
            {badgeLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {failed ? (
          <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-950">
            Agentic action health is temporarily unavailable.
          </div>
        ) : (
          <>
            <div className="grid gap-3 rounded-md border bg-muted/30 p-3 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  What changed
                </p>
                <p className="text-sm leading-relaxed">
                  {briefing.whatChanged}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Needs attention
                </p>
                <p className="text-sm leading-relaxed">
                  {briefing.needsAttention}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Next move
                </p>
                <p className="text-sm leading-relaxed">{briefing.nextMove}</p>
              </div>
            </div>
            {recentSessionRecords.length > 0 && (
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Recent activity
                </p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {recentSessionRecords.map((record) => (
                    <li key={`${record.session_id}-${record.updated_at}`}>
                      <span className="font-medium text-foreground">
                        {record.session_id}
                      </span>{' '}
                      moved to {formatPaymentStateLabel(record.payment_state)}.
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {idempotencyPressureRecords.length > 0 && (
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Idempotency pressure
                </p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {idempotencyPressureRecords.map((record) => (
                    <li
                      key={`${record.route}-${record.updated_at}-${record.state}`}
                    >
                      <span className="font-medium text-foreground">
                        {record.route}
                      </span>{' '}
                      is {formatIdempotencyStateLabel(record.state)} (
                      {record.status_code == null
                        ? 'pending'
                        : `status ${record.status_code}`}
                      ).
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {requestControls && (
              <AgenticRequestControlsCard requestControls={requestControls} />
            )}
            {recentRequestCount > 0 && (
              <AgenticRecentSignedRequestsCard
                recentRequestCount={recentRequestCount}
                recentRequestRecords={recentRequestRecords}
              />
            )}
            {actions.map((action) => {
              const tone = getActionTone(action.severity);
              const Icon = tone.icon;
              const href = agenticActionCenterCardHelpers.getActionHref(action);

              return (
                <div
                  className={cn(
                    'flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between',
                    tone.className
                  )}
                  key={action.code}
                >
                  <div className="flex min-w-0 gap-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{tone.label}</p>
                        {action.count > 0 && (
                          <span className="text-xs text-current/70">
                            {action.count} affected
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-current/75">
                        {action.message}
                      </p>
                      {action.next_step && (
                        <p className="mt-1 text-xs text-current/70">
                          Next step: {action.next_step}
                        </p>
                      )}
                    </div>
                  </div>
                  {href && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={href}>
                        Review
                        <ExternalLink className="ml-2 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                </div>
              );
            })}
          </>
        )}
      </CardContent>
      {generatedAt && !failed && (
        <CardFooter className="pt-0 text-xs text-muted-foreground">
          Updated {generatedAt}
        </CardFooter>
      )}
    </Card>
  );
}
