'use client';

import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
