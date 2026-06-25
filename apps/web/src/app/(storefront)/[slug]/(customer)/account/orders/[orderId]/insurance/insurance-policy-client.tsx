'use client';

import mycoverai from '@mycoverai/mca-javascript-sdk';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  resolveClaimUrl,
  resolveInspectionUrl,
  resolveInsuranceCta,
} from './claim-action-helpers';
import { InsurancePolicyAlerts } from './insurance-policy-alerts';
import { InsurancePolicyFooterActions } from './insurance-policy-footer-actions';
import type { PolicyFetchResult } from './insurance-policy-types';

function toSafeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function formatPolicyDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(date);
}

interface InsurancePolicyClientProps {
  initialResult: PolicyFetchResult;
}

export function InsurancePolicyClient({
  initialResult,
}: InsurancePolicyClientProps) {
  const router = useRouter();
  const [claimFallbackError, setClaimFallbackError] = useState<string | null>(
    null
  );
  const { policy, error } = initialResult;

  const openHostedFlow = (url: string) => {
    const safeUrl = toSafeExternalUrl(url);
    if (!safeUrl) return;
    window.open(safeUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCompleteInspection = () => {
    if (!policy) return;
    const inspectionUrl = resolveInspectionUrl(policy);
    if (inspectionUrl) openHostedFlow(inspectionUrl);
  };

  const handleFileClaim = () => {
    setClaimFallbackError(null);

    // Prefer MyCover's official hosted claim flow when we captured the link
    // from the purchase webhook. The SDK modal below is a legacy fallback for
    // policies created before links were persisted.
    if (policy) {
      const claimUrl = resolveClaimUrl(policy);
      if (claimUrl) {
        openHostedFlow(claimUrl);
        return;
      }
    }

    const publicKey = process.env.NEXT_PUBLIC_MYCOVER_PUBLIC_KEY;
    if (!publicKey) {
      setClaimFallbackError(
        'Claims system is currently unavailable (Missing Configuration). Please contact support.'
      );
      return;
    }

    const claimProductId =
      policy?.itemsInsured?.product_id ||
      process.env.NEXT_PUBLIC_MYCOVER_GADGET_PRODUCT_ID;
    if (!claimProductId) {
      setClaimFallbackError(
        'Claims system is currently unavailable (Missing Product Configuration). Please contact support.'
      );
      return;
    }

    // Initialize SDK
    mycoverai({
      action: 'claim',
      pk: publicKey,
      pid: [claimProductId],
      policy_number: policy?.policyNumber, // Pass policy number if supported/required to pre-fill
      email: policy?.customer_email, // Pre-fill email
      onClose: () => {
        console.log('Claim modal closed');
      },
      callback: (response: unknown) => {
        console.log('Claim submitted', response);
        router.refresh();
      },
    });
  };

  if (error || !policy) {
    return (
      <div className="flex flex-col items-center justify-center gap-y-4 py-12">
        <AlertTriangle className="size-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Policy Not Found</h2>
        <p className="text-muted-foreground text-center max-w-md">{error}</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  const cta = resolveInsuranceCta(policy);
  const certificateUrl = toSafeExternalUrl(policy.certificateUrl);

  return (
    <div className="container max-w-3xl py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Standard Insurance Policy
        </h1>
        <p className="text-muted-foreground">
          Managed by MyCover.ai • Underwritten by {policy.provider}
        </p>
      </div>

      <InsurancePolicyAlerts ctaKind={cta.kind} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base font-medium">
              Policy Status
            </CardTitle>
            <CardDescription>{policy.policyNumber}</CardDescription>
          </div>
          <Badge
            variant={policy.status === 'active' ? 'default' : 'secondary'}
            className="text-sm"
          >
            {policy.status.toUpperCase()}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Start Date
              </div>
              <div className="font-semibold">
                {formatPolicyDate(policy.startDate)}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Expiry Date
              </div>
              <div className="font-semibold">
                {formatPolicyDate(policy.expiryDate)}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Coverage Amount
              </div>
              <div className="font-semibold">
                ₦{policy.coverage.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Premium Paid
              </div>
              <div className="font-semibold">
                ₦{policy.premium.toLocaleString()}
              </div>
            </div>
          </div>

          <Separator className="my-2" />

          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">
              Insured Item
            </div>
            <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/40">
              <ShieldCheck
                className="size-5"
                style={{ color: 'var(--store-primary)' }}
              />
              <span className="font-medium">
                {policy.itemsInsured?.product_name || 'Device'}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                IMEI: {policy.itemsInsured?.imei}
              </span>
            </div>
          </div>

          {(policy.claimStage ||
            (policy.claimStatus && policy.claimStatus !== 'None')) && (
            <>
              <Separator className="my-2" />
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  Claim Status
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-sm capitalize">
                    {policy.claimStage ||
                      (policy.claimStatus ?? '').replace(/_/g, ' ')}
                  </Badge>
                </div>
                {policy.claimComment && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {policy.claimComment}
                  </p>
                )}
              </div>
            </>
          )}

          {claimFallbackError && (
            <div
              role="alert"
              className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-foreground"
            >
              {claimFallbackError}
            </div>
          )}
        </CardContent>
        <InsurancePolicyFooterActions
          certificateUrl={certificateUrl}
          cta={cta}
          onCompleteInspection={handleCompleteInspection}
          onFileClaim={handleFileClaim}
        />
      </Card>

      <div className="rounded-lg border p-4 bg-muted/20">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <AlertTriangle className="size-4" /> Important Information
        </h3>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          <li>Claims must be reported within 48 hours of the incident.</li>
          <li>
            Digital proof of purchase and ID may be required during the claim
            process.
          </li>
          <li>
            Screen damage and liquid damage are covered under this policy.
          </li>
        </ul>
      </div>
    </div>
  );
}
