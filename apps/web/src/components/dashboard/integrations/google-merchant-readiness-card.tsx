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
  MerchantCenterReadiness,
  MerchantCenterReadinessCheck,
} from '@/lib/storefront-trust/build-google-merchant-readiness';
import { cn } from '@/lib/utils';

const READINESS_ENDPOINT = '/api/integrations/google-merchant-center/readiness';

function getSeverityStyles(severity: MerchantCenterReadinessCheck['severity']) {
  if (severity === 'pass') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (severity === 'warn') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  return 'border-red-200 bg-red-50 text-red-700';
}

export function GoogleMerchantReadinessCard() {
  const [readiness, setReadiness] = useState<MerchantCenterReadiness | null>(
    null
  );
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
          throw new Error('Unable to load Merchant Center readiness');
        }

        const data = (await response.json()) as MerchantCenterReadiness;
        if (isMounted) {
          setReadiness(data);
        }
      } catch (fetchError) {
        if (isMounted) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : 'Unable to load Merchant Center readiness'
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
        <CardTitle>Merchant Center readiness</CardTitle>
        <CardDescription>
          Check the trust and feed signals Google expects before launch.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking readiness...
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : readiness ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {readiness.totals.products} products checked,{' '}
              {readiness.totals.withVerifiedImage} with verified images,{' '}
              {readiness.totals.withIdentifier} with identifiers.
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
