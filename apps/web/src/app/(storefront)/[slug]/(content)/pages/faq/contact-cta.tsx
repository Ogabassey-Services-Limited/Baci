'use client';

import Link from 'next/link';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { asRoute } from '@/lib/routes';

export function ContactCTA() {
  const merchantCtx = useMerchantSafe();
  const basePath = merchantCtx?.basePath ?? '';
  return (
    <Link
      href={asRoute(`${basePath}/contact`)}
      className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
    >
      Contact Support
    </Link>
  );
}
