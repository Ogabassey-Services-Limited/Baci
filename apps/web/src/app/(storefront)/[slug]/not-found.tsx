'use client';

import { ArrowLeft, Home, Search } from 'lucide-react';
import Link from 'next/link';
import { ThemedButton } from '@/components/themed/themed-button';
import { useMerchantSafe } from '@/hooks/merchant/use-merchant';
import { asRoute } from '@/lib/routes';

export default function StorefrontNotFound() {
  const merchantContext = useMerchantSafe();
  const merchant = merchantContext?.merchant;
  const isLoading = merchantContext?.loading;
  const basePath = merchantContext?.basePath;
  const storeName = merchant?.business_name || 'Store';

  if (isLoading) {
    return (
      <div
        className="relative isolate flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center bg-store-background p-8 text-store-background-text animate-pulse"
        role="status"
        aria-label="Loading page"
      >
        <div className="h-32 w-48 bg-gray-200 dark:bg-gray-800 rounded-lg mb-8" />
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-800 rounded mb-4" />
        <div className="h-4 w-96 bg-gray-200 dark:bg-gray-800 rounded" />
      </div>
    );
  }

  return (
    <div className="relative isolate flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center bg-store-background px-4 py-16 text-store-background-text sm:px-8">
      <div className="text-center space-y-6 max-w-lg rounded-3xl border border-store-border bg-store-background/95 p-6 shadow-2xl sm:p-8">
        {/* Animated 404 number with brand color */}
        <div
          className="text-8xl md:text-9xl font-bold opacity-20"
          style={{ color: 'var(--store-primary, #3B82F6)' }}
        >
          404
        </div>

        <h1
          className="text-3xl md:text-4xl font-bold -mt-8"
          style={{ color: 'var(--store-primary, #1F2937)' }}
        >
          Page Not Found
        </h1>

        <p className="text-store-background-text text-lg">
          We couldn&apos;t find what you&apos;re looking for. The page may have
          been moved, deleted, or never existed.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link href={asRoute(`${basePath || ''}/`)}>
            <ThemedButton
              colorRole="primary"
              size="lg"
              className="w-full sm:w-auto"
            >
              <Home className="mr-2 size-4" />
              Back to {storeName}
            </ThemedButton>
          </Link>
          <Link href={asRoute(`${basePath || ''}/#products`)}>
            <ThemedButton
              colorRole="accent"
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
            >
              <Search className="mr-2 size-4" />
              Browse Products
            </ThemedButton>
          </Link>
        </div>

        {/* Navigation help */}
        <div className="pt-8 border-t border-border mt-8">
          <p className="text-sm text-store-background-text mb-4">
            Here are some helpful links:
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link
              href={asRoute(`${basePath || ''}/`)}
              className="text-store-background-text hover:text-store-primary transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="size-3" /> Home
            </Link>
            <span className="text-border">|</span>
            <Link
              href={asRoute(`${basePath || ''}/#products`)}
              className="text-store-background-text hover:text-store-primary transition-colors"
            >
              All Products
            </Link>
            {merchant?.pages?.contact && (
              <>
                <span className="text-border">|</span>
                <Link
                  href={asRoute(`${basePath || ''}/pages/contact`)}
                  className="text-store-background-text hover:text-store-primary transition-colors"
                >
                  Contact Us
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
