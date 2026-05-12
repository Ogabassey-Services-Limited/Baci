'use client';

import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
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

type AgenticActionSeverity = 'attention' | 'monitor' | 'ok';

interface AgenticAction {
  code: string;
  count: number;
  message: string;
  severity: AgenticActionSeverity;
}

interface AgenticActionHealthPayload {
  actions: AgenticAction[];
  generated_at?: string;
}

function isAgenticAction(value: unknown): value is AgenticAction {
  if (!value || typeof value !== 'object') return false;

  const action = value as Record<string, unknown>;
  return (
    typeof action.code === 'string' &&
    typeof action.count === 'number' &&
    typeof action.message === 'string' &&
    (action.severity === 'attention' ||
      action.severity === 'monitor' ||
      action.severity === 'ok')
  );
}

function isAgenticActionHealthPayload(
  value: unknown
): value is AgenticActionHealthPayload {
  if (!value || typeof value !== 'object') return false;

  const payload = value as Record<string, unknown>;
  return (
    Array.isArray(payload.actions) &&
    payload.actions.every(isAgenticAction) &&
    (payload.generated_at === undefined ||
      typeof payload.generated_at === 'string')
  );
}

function getActionHref(code: string) {
  switch (code) {
    case 'AGENTIC_IDEMPOTENCY_ERRORS':
    case 'AGENTIC_ORDER_FINALIZING':
    case 'AGENTIC_PAYMENT_PENDING':
      return '/dashboard/orders?source=agentic';
    default:
      return null;
  }
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

function formatGeneratedAt(value?: string) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function AgenticActionCenterCard() {
  const [payload, setPayload] = useState<AgenticActionHealthPayload | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadHealth() {
      try {
        const response = await fetch('/api/merchant/agentic/action-health', {
          credentials: 'include',
        });

        if (response.status === 401 || response.status === 403) {
          if (active) {
            setPayload(null);
            setFailed(false);
          }
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to load agentic action health');
        }

        const value: unknown = await response.json();
        if (active) {
          setPayload(isAgenticActionHealthPayload(value) ? value : null);
          setFailed(!isAgenticActionHealthPayload(value));
        }
      } catch (error) {
        console.error('Failed to load agentic action health:', error);
        if (active) {
          setFailed(true);
          setPayload(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadHealth();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <Card className="border-border/70">
        <CardContent className="flex items-center gap-3 py-5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking agentic action health...
        </CardContent>
      </Card>
    );
  }

  if (!payload && !failed) return null;

  const actions = payload?.actions ?? [];
  const attentionCount = actions.reduce(
    (total, action) =>
      action.severity === 'attention' ? total + action.count : total,
    0
  );
  const generatedAt = formatGeneratedAt(payload?.generated_at);
  const statusDescription = failed
    ? 'Agentic checkout health could not be loaded.'
    : attentionCount > 0
      ? 'Agentic checkout issues need review before buyers retry.'
      : 'Agentic checkout activity is stable right now.';
  const badgeLabel = failed
    ? 'Unavailable'
    : attentionCount > 0
      ? `${attentionCount} open`
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
          actions.map((action) => {
            const tone = getActionTone(action.severity);
            const Icon = tone.icon;
            const href = getActionHref(action.code);

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
                    <p className="text-sm text-current/75">{action.message}</p>
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
          })
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
