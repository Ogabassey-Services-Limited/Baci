'use client';

import { AlertTriangle, Loader2, ReceiptText, Smartphone } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import { useMerchant } from '@/hooks/use-merchant-client';
import { fetchWithCsrf } from '@/lib/api-client';
import { asRoute } from '@/lib/routes';
import {
  createDeviceListItems,
  getParamValue,
  joinBasePath,
  readClaimError,
} from './receipt-claim-page-utils';

interface ClaimPreview {
  claim: {
    claimed: boolean;
    customerName: string | null;
    devices: string[];
    merchantName: string;
  };
}

export default function ReceiptClaimPage() {
  const params = useParams();
  const router = useRouter();
  const token = getParamValue(params.token);
  const { basePath, loading: merchantLoading } = useMerchant();
  const { isAuthenticated, isLoading: authLoading } = useCustomerAuth();
  const [preview, setPreview] = useState<ClaimPreview['claim'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemedToken, setRedeemedToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      if (!token) {
        setError('Invalid receipt claim link');
        setIsLoadingPreview(false);
        return;
      }

      setIsLoadingPreview(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/storefront/receipts/claims/${encodeURIComponent(token)}`,
          { cache: 'no-store' }
        );
        const data = (await response.json()) as
          | ClaimPreview
          | { error?: string };

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setError(readClaimError(data, 'Unable to load receipt claim'));
          setPreview(null);
          return;
        }

        if (!('claim' in data)) {
          setError('Unable to load receipt claim');
          setPreview(null);
          return;
        }

        setPreview(data.claim);
      } catch {
        if (!cancelled) {
          setError('Unable to load receipt claim');
          setPreview(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPreview(false);
        }
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (
      !token ||
      !preview ||
      preview.claimed ||
      error ||
      authLoading ||
      merchantLoading ||
      !isAuthenticated ||
      isRedeeming ||
      redeemedToken === token
    ) {
      return;
    }

    let cancelled = false;

    async function redeemClaim() {
      setIsRedeeming(true);

      try {
        const response = await fetchWithCsrf(
          `/api/storefront/receipts/claims/${encodeURIComponent(token)}`,
          { method: 'POST' }
        );
        const data = (await response.json()) as {
          error?: string;
          redirectPath?: string;
          success?: boolean;
        };

        if (cancelled) {
          return;
        }

        if (!response.ok || !data.success) {
          setError(data.error || 'Unable to claim receipt');
          return;
        }

        setRedeemedToken(token);
        router.push(
          asRoute(joinBasePath(basePath, data.redirectPath || '/receipts'))
        );
      } catch {
        if (!cancelled) {
          setError('Unable to claim receipt');
        }
      } finally {
        if (!cancelled) {
          setIsRedeeming(false);
        }
      }
    }

    void redeemClaim();

    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    basePath,
    error,
    isAuthenticated,
    isRedeeming,
    merchantLoading,
    preview,
    redeemedToken,
    router,
    token,
  ]);

  const loginRedirectPath = joinBasePath(
    basePath,
    `/receipts/claim/${encodeURIComponent(token)}`
  );
  const loginPath = joinBasePath(
    basePath,
    `/account/login?redirect=${encodeURIComponent(loginRedirectPath)}`
  );

  return (
    <main className="min-h-screen bg-store-background px-4 py-10 text-store-background-text">
      <section className="mx-auto flex min-h-[70vh] max-w-2xl items-center">
        <Card className="w-full border-store-border bg-store-background shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-store-primary/10 text-store-primary">
              {error ? (
                <AlertTriangle aria-hidden="true" className="size-6" />
              ) : (
                <ReceiptText aria-hidden="true" className="size-6" />
              )}
            </div>
            <div>
              <CardTitle className="text-2xl">
                {preview?.customerName
                  ? `Welcome ${preview.customerName}`
                  : 'Receipt claim'}
              </CardTitle>
              <CardDescription className="mt-2 text-base">
                {preview
                  ? `${preview.merchantName} has moved your receipt to the mobile app.`
                  : 'Loading your receipt claim.'}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {isLoadingPreview ? (
              <div
                aria-live="polite"
                className="flex items-center gap-3 rounded-md border border-store-border bg-store-secondary/60 p-4 text-sm"
                role="status"
              >
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                <span>Loading receipt claim...</span>
              </div>
            ) : error ? (
              <div
                aria-live="polite"
                className="rounded-md border border-store-primary/30 bg-store-primary/10 p-4 text-sm font-medium text-store-background-text"
                role="status"
              >
                {error}
              </div>
            ) : preview ? (
              <>
                <div className="rounded-md border border-store-border bg-store-secondary/60 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-store-primary">
                    <Smartphone aria-hidden="true" className="size-4" />
                    Device receipts
                  </div>
                  <ol className="space-y-2 pl-5 text-sm">
                    {createDeviceListItems(preview.devices).map((item) => (
                      <li key={item.key}>{item.device}</li>
                    ))}
                  </ol>
                </div>

                <p className="text-sm text-store-background-text/70">
                  {preview.claimed
                    ? 'This receipt link has already been claimed. You can view it from the receipts panel.'
                    : 'Sign in with the email address that received this link. Once verified, you will land in the receipts panel.'}
                </p>

                {preview.claimed ? (
                  <Button
                    className="w-full bg-store-primary text-store-primary-text hover:bg-store-primary/90"
                    type="button"
                    onClick={() => {
                      router.push(asRoute(joinBasePath(basePath, '/receipts')));
                    }}
                  >
                    View receipts
                  </Button>
                ) : isAuthenticated ? (
                  <div className="flex items-center gap-3 text-sm font-medium text-store-background-text/70">
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                    <span>
                      {isRedeeming
                        ? 'Claiming receipt...'
                        : 'Preparing receipts...'}
                    </span>
                  </div>
                ) : (
                  <Button
                    className="w-full bg-store-primary text-store-primary-text hover:bg-store-primary/90"
                    type="button"
                    onClick={() => {
                      router.push(asRoute(loginPath));
                    }}
                  >
                    Sign in to claim receipt
                  </Button>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
