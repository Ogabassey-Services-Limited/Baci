'use client';

import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchWithCsrf } from '@/lib/api-client';

type PurchaseStatus = 'processing' | 'success' | 'error';

interface CompletePurchaseContext {
  reference: string | null;
  domain: string | null;
  years: string;
  setStatus: (status: PurchaseStatus) => void;
  setMessage: (message: string) => void;
  setErrorDetails: (details: string | null) => void;
}

// Module-scope helper so the effect depends on primitive search params instead
// of a function rebuilt on every render.
async function completePurchase({
  reference,
  domain,
  years,
  setStatus,
  setMessage,
  setErrorDetails,
}: CompletePurchaseContext) {
  if (!reference || !domain) {
    setStatus('error');
    setMessage('Missing payment information');
    setErrorDetails('Reference or domain parameter is missing from the URL.');
    return;
  }

  const parsedYears = /^\d+$/.test(years)
    ? Number.parseInt(years, 10)
    : Number.NaN;
  if (!Number.isInteger(parsedYears) || parsedYears < 1 || parsedYears > 10) {
    setStatus('error');
    setMessage('Invalid registration term');
    setErrorDetails(
      'The registration term in the URL is invalid. It must be between 1 and 10 years.'
    );
    return;
  }

  try {
    // First verify the payment status via Paystack
    setMessage('Verifying payment...');

    const verifyResponse = await fetch(
      `/api/payments/status?gateway=paystack&reference=${encodeURIComponent(reference)}`
    );
    const verifyData = await verifyResponse.json();

    if (!verifyResponse.ok || !verifyData.is_confirmed) {
      setStatus('error');
      setMessage('Payment not completed');
      setErrorDetails(
        verifyData.is_pending
          ? 'Your payment is still being processed. Please wait and refresh this page.'
          : verifyData.error ||
              'Your payment was not successful. Please try again.'
      );
      return;
    }

    // Payment verified, now complete the domain purchase
    setMessage('Registering your domain...');

    const purchaseResponse = await fetchWithCsrf('/api/domains/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain,
        years: parsedYears,
        paymentReference: reference,
      }),
    });

    const purchaseData = await purchaseResponse.json();

    if (!purchaseResponse.ok) {
      setStatus('error');
      setMessage('Domain registration failed');
      setErrorDetails(
        purchaseData.error ||
          'Failed to register domain. Please contact support.'
      );
      return;
    }

    // Success!
    setStatus('success');
    setMessage(`Successfully registered ${domain}!`);
  } catch (error) {
    console.error('Domain purchase callback error:', error);
    setStatus('error');
    setMessage('An error occurred');
    setErrorDetails(
      'Please contact support if you were charged but the domain was not registered.'
    );
  }
}

function DomainPaymentCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const reference = searchParams.get('reference');
  const domain = searchParams.get('domain');
  const years = searchParams.get('years') || '1';

  const [status, setStatus] = useState<PurchaseStatus>('processing');
  const [message, setMessage] = useState('Processing your payment...');
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  // Guards the purchase POST against duplicate firing for the same callback
  // params (Strict Mode double-invokes effects in development).
  const completedPurchaseKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const purchaseKey = `${reference ?? ''}|${domain ?? ''}|${years}`;
    if (completedPurchaseKeyRef.current === purchaseKey) {
      return;
    }
    completedPurchaseKeyRef.current = purchaseKey;
    void completePurchase({
      reference,
      domain,
      years,
      setStatus,
      setMessage,
      setErrorDetails,
    });
  }, [reference, domain, years]);

  return (
    <div className="container mx-auto p-6 flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {status === 'processing' && (
              <div className="size-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                <Loader2 className="size-8 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
            )}
            {status === 'success' && (
              <div className="size-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <CheckCircle2 className="size-8 text-green-600 dark:text-green-400" />
              </div>
            )}
            {status === 'error' && (
              <div className="size-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <XCircle className="size-8 text-red-600 dark:text-red-400" />
              </div>
            )}
          </div>
          <CardTitle className="text-xl">{message}</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === 'processing' && (
            <p className="text-muted-foreground">
              Please wait while we complete your domain registration…
            </p>
          )}

          {status === 'success' && (
            <>
              <p className="text-muted-foreground">
                Your domain has been registered and will be active within 24
                hours.
              </p>
              <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-lg">
                <p className="font-semibold text-green-800 dark:text-green-200">
                  {domain}
                </p>
              </div>
              <Button
                onClick={() => router.push('/dashboard/domains')}
                className="w-full"
              >
                View My Domains
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              {errorDetails && (
                <p className="text-sm text-muted-foreground">{errorDetails}</p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => router.push('/dashboard/domains?tab=search')}
                  className="flex-1"
                >
                  Try Again
                </Button>
                <Button
                  onClick={() => router.push('/dashboard/support')}
                  className="flex-1"
                >
                  Contact Support
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DomainPaymentCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-6 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <DomainPaymentCallbackContent />
    </Suspense>
  );
}
