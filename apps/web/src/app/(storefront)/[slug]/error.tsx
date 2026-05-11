'use client';

import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { ThemedButton } from '@/components/themed/themed-button';
import { useMerchantSafe } from '@/hooks/merchant/use-merchant';
import { asRoute } from '@/lib/routes';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function StorefrontError({ error, reset }: ErrorProps) {
  const merchantContext = useMerchantSafe();
  const basePath = merchantContext?.basePath;

  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Storefront error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8">
      <div className="text-center space-y-6 max-w-lg">
        {/* Error icon */}
        <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>

        <h1
          className="text-3xl md:text-4xl font-bold"
          style={{ color: 'var(--store-primary, #1F2937)' }}
        >
          Something Went Wrong
        </h1>

        <p className="text-muted-foreground text-lg">
          We encountered an unexpected error while loading this page. Please try
          again or return to the homepage.
        </p>

        {/* Error details for development */}
        {process.env.NODE_ENV === 'development' && (
          <details className="text-left bg-muted/50 rounded-lg p-4 text-sm">
            <summary className="cursor-pointer font-medium text-muted-foreground">
              Error Details (Development Only)
            </summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-destructive">
              {error.message}
            </pre>
            {error.digest && (
              <p className="mt-2 text-xs text-muted-foreground">
                Error ID: {error.digest}
              </p>
            )}
          </details>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <ThemedButton
            colorRole="primary"
            size="lg"
            onClick={reset}
            className="w-full sm:w-auto"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </ThemedButton>
          <Link href={asRoute(`${basePath || ''}/`)}>
            <ThemedButton
              colorRole="accent"
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
            >
              <Home className="mr-2 h-4 w-4" />
              Go to Homepage
            </ThemedButton>
          </Link>
        </div>

        {/* Support message */}
        <p className="text-sm text-muted-foreground pt-4">
          If this problem persists, please{' '}
          <Link
            href={asRoute(`${basePath || ''}/pages/contact`)}
            className="text-primary hover:underline"
          >
            contact support
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
