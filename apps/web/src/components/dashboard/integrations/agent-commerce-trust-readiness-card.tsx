'use client';

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type {
  AgentCommerceTrustCheck,
  AgentCommerceTrustReadiness,
} from '@/lib/storefront-trust/build-agent-commerce-trust-readiness';
import { cn } from '@/lib/utils';
import { agentCommerceTrustReadinessCardHelpers } from './agent-commerce-trust-readiness-card-helpers';

const READINESS_ENDPOINT = '/api/integrations/agent-commerce/readiness';

function getSeverityStyles(severity: AgentCommerceTrustCheck['severity']) {
  if (severity === 'pass') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (severity === 'warn') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  return 'border-red-200 bg-red-50 text-red-700';
}

function getStatusCopy(status: AgentCommerceTrustReadiness['status']) {
  if (status === 'pass') return 'Agent trust health is ready.';
  if (status === 'warn') return 'Agent trust health needs attention.';
  return 'Agent trust health has blockers.';
}

export function AgentCommerceTrustReadinessCard() {
  const [readiness, setReadiness] =
    useState<AgentCommerceTrustReadiness | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const actionItems = readiness
    ? agentCommerceTrustReadinessCardHelpers.buildTrustActionItems(readiness)
    : [];
  const contractLinks = readiness
    ? agentCommerceTrustReadinessCardHelpers.buildMachineContractLinks(
        readiness
      )
    : [];

  useEffect(() => {
    let isMounted = true;

    const loadReadiness = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(READINESS_ENDPOINT);
        if (!response.ok) {
          throw new Error('Unable to load agent trust health');
        }

        const data = (await response.json()) as AgentCommerceTrustReadiness;
        if (isMounted) {
          setReadiness(data);
        }
      } catch (fetchError) {
        if (isMounted) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : 'Unable to load agent trust health'
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadReadiness();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Agent trust health</CardTitle>
        <CardDescription>
          Check whether shopping agents can trust your catalog, policies, and
          machine-readable commerce surfaces.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking agent trust health...
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : readiness ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {getStatusCopy(readiness.status)}{' '}
              {readiness.totals.sharedProducts} products are shared across agent
              and Google feed sources.
            </p>

            {contractLinks.length > 0 ? (
              <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                <div>
                  <p className="text-sm font-medium">Machine contracts</p>
                  <p className="text-xs text-muted-foreground">
                    Public proof links for shopping agents, validators, and
                    partner reviews.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {contractLinks.map((link) => (
                    <div
                      className="flex min-w-0 items-center justify-between gap-3 rounded-md border bg-background p-3"
                      key={link.id}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{link.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {link.description}
                        </p>
                      </div>
                      <Button asChild size="icon" variant="outline">
                        <a
                          aria-label={`Open ${link.label}`}
                          href={link.href}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {actionItems.length > 0 ? (
              <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                <div>
                  <p className="text-sm font-medium">Priority fixes</p>
                  <p className="text-xs text-muted-foreground">
                    Start with these dashboard actions to move trust health
                    toward ready.
                  </p>
                </div>
                <ul className="space-y-3">
                  {actionItems.map((action) => (
                    <li
                      className="flex flex-col gap-3 rounded-md border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                      key={action.id}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{action.label}</p>
                          {action.count !== null && action.count > 0 ? (
                            <span className="text-xs text-muted-foreground">
                              {action.count} affected
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {action.message}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link
                          aria-label={`Review ${action.label}`}
                          href={action.href}
                        >
                          Review
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <ul className="space-y-3">
              {readiness.checks.map((check) => (
                <li
                  key={check.id}
                  className={cn(
                    'rounded-lg border p-3 text-sm',
                    getSeverityStyles(check.severity)
                  )}
                >
                  <div className="flex items-start gap-3">
                    {check.severity === 'pass' ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <div className="space-y-1">
                      <div className="font-medium">{check.label}</div>
                      <div>{check.message}</div>
                      {check.affectedProductIds?.length ? (
                        <div className="text-xs">
                          {check.affectedProductIds.length} affected products
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
