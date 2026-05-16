'use client';

import { AlertTriangle, ExternalLink, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { agentCommerceTrustReadinessCardHelpers } from '@/components/dashboard/integrations/agent-commerce-trust-readiness-card-helpers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { AgentCommerceTrustReadiness } from '@/lib/storefront-trust/build-agent-commerce-trust-readiness';

const MAX_ACTION_ITEMS = 3;

export type TrustCenterState = 'ready' | 'error' | 'unauthorized';

interface AgenticTrustCenterCardProps {
  readiness: AgentCommerceTrustReadiness | null;
  state: TrustCenterState;
}

function getStatusLabel(status: AgentCommerceTrustReadiness['status']) {
  if (status === 'pass') return 'Healthy';
  if (status === 'warn') return 'Needs review';
  return 'Needs fixes';
}

function getStatusDescription(status: AgentCommerceTrustReadiness['status']) {
  if (status === 'pass') {
    return 'Trust checks are healthy for agent discovery and conversion.';
  }

  if (status === 'warn') {
    return 'Trust checks need attention to avoid degraded agent confidence.';
  }

  return 'Trust blockers are reducing agent conversion reliability.';
}

function buildStatusSummary(readiness: AgentCommerceTrustReadiness) {
  const failingChecks = readiness.checks.filter(
    (check) => check.severity === 'fail'
  ).length;
  const warningChecks = readiness.checks.filter(
    (check) => check.severity === 'warn'
  ).length;
  const sharedProducts = readiness.totals.sharedProducts;

  return `${failingChecks} failing checks, ${warningChecks} warning checks, ${sharedProducts} shared products.`;
}

export function AgenticTrustCenterCard({
  readiness,
  state,
}: AgenticTrustCenterCardProps) {
  const actions = readiness
    ? agentCommerceTrustReadinessCardHelpers
        .buildTrustActionItems(readiness)
        .slice(0, MAX_ACTION_ITEMS)
    : [];

  if (state === 'unauthorized') return null;

  if (state === 'error' || !readiness) {
    return (
      <Card className="border-border/70">
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Agent trust center
          </CardTitle>
          <CardDescription>
            Trust health is temporarily unavailable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-950">
            <p className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Unable to load trust readiness right now.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/70">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Agent trust center
            </CardTitle>
            <CardDescription>
              {getStatusDescription(readiness.status)}
            </CardDescription>
          </div>
          <Badge
            variant={
              readiness.status === 'pass'
                ? 'secondary'
                : readiness.status === 'warn'
                  ? 'outline'
                  : 'destructive'
            }
          >
            {getStatusLabel(readiness.status)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
          {buildStatusSummary(readiness)}
        </div>

        {actions.length > 0 ? (
          actions.map((action) => (
            <div
              className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
              key={action.id}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{action.label}</p>
                <p className="text-sm text-muted-foreground">
                  {action.message}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={action.href}>
                  Review
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          ))
        ) : (
          <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
            No trust issues require action right now.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
