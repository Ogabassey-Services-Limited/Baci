'use client';

import { AlertTriangle } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useMerchantSafe } from '@/hooks/use-merchant-client';
import { resolveStorefrontPathHref } from '@/lib/storefront-path-prefix';

interface ImeiCheckerErrorProps {
  error: string;
  needsWalletFunding: boolean;
}

export function ImeiCheckerError({
  error,
  needsWalletFunding,
}: ImeiCheckerErrorProps) {
  const basePath = useMerchantSafe()?.basePath ?? '';

  return (
    <div
      className="mt-4 p-4 bg-[var(--store-danger-bg,#fef2f2)] border border-[var(--store-danger-border,#fecaca)] rounded-2xl flex items-start gap-3 text-left"
      role="alert"
    >
      <AlertTriangle
        className="text-[var(--store-danger-text,#dc2626)] shrink-0"
        size={20}
      />
      <div className="space-y-2">
        <p className="text-sm text-[var(--store-danger-text,#b91c1c)]">
          {error}
        </p>
        {needsWalletFunding ? (
          <Link
            className="inline-flex rounded-lg bg-[var(--store-primary)] px-3 py-2 text-sm font-bold text-[var(--store-primary-text,#ffffff)] hover:opacity-90"
            href={
              resolveStorefrontPathHref(basePath, '/wallet?fund=1') as Route
            }
          >
            Fund wallet
          </Link>
        ) : null}
      </div>
    </div>
  );
}
