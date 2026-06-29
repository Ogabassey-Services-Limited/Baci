'use client';

import { Download, Smartphone } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  OGABASSEY_STOREFRONT_APP_STORE_URL,
  OGABASSEY_STOREFRONT_PLAY_STORE_URL,
} from '@/config/platform';
import { fetchWithCsrf } from '@/lib/api-client';
import { readReceiptClaimAppDownloadToken } from '@/lib/import-notifications/receipt-claim-app-download-storage';

interface ReceiptClaimAppDownloadBannerProps {
  readTrackingToken?: () => string | null;
}

export function ReceiptClaimAppDownloadBanner({
  readTrackingToken,
}: ReceiptClaimAppDownloadBannerProps) {
  const searchParams = useSearchParams();
  const [trackingToken, setTrackingToken] = useState<string | null>(null);
  const hasClaimedRedirect = searchParams.get('receiptClaimed') === '1';

  useEffect(() => {
    if (readTrackingToken) {
      setTrackingToken(readTrackingToken() ?? null);
      return;
    }

    setTrackingToken(readReceiptClaimAppDownloadToken() ?? null);
  }, [readTrackingToken]);

  if (!hasClaimedRedirect && !trackingToken) {
    return null;
  }

  function trackDownloadClick(target: 'app_store' | 'play_store') {
    if (!trackingToken) {
      return;
    }

    void fetchWithCsrf(
      `/api/storefront/receipts/claims/${encodeURIComponent(trackingToken)}/app-download-click`,
      {
        body: JSON.stringify({ target }),
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        keepalive: true,
        method: 'POST',
      }
    ).catch(() => undefined);
  }

  return (
    <section className="mb-6 rounded-2xl border border-store-primary/10 bg-store-background p-4 shadow-sm md:flex md:items-center md:justify-between md:gap-6">
      <div className="mb-4 flex gap-3 md:mb-0">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-store-primary/5 text-store-primary">
          <Smartphone aria-hidden="true" size={22} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-store-primary">
            Receipts ready
          </p>
          <h2 className="text-base font-bold text-store-background-text">
            Keep your receipts in the Ogabassey app
          </h2>
          <p className="mt-1 text-sm text-store-background-text/65">
            Download the app and sign in with the same email to find your
            receipts anytime.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 md:min-w-[280px]">
        <a
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-store-background-text/15 px-4 py-2.5 text-sm font-bold text-store-background-text/75 transition-colors hover:border-store-primary/25 hover:bg-store-primary/5 hover:text-store-primary"
          href={OGABASSEY_STOREFRONT_APP_STORE_URL}
          onClick={() => trackDownloadClick('app_store')}
          rel="noopener noreferrer"
          target="_blank"
        >
          <Download aria-hidden="true" size={16} />
          App Store
        </a>
        <a
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-store-background-text/15 px-4 py-2.5 text-sm font-bold text-store-background-text/75 transition-colors hover:border-store-primary/25 hover:bg-store-primary/5 hover:text-store-primary"
          href={OGABASSEY_STOREFRONT_PLAY_STORE_URL}
          onClick={() => trackDownloadClick('play_store')}
          rel="noopener noreferrer"
          target="_blank"
        >
          <Download aria-hidden="true" size={16} />
          Google Play
        </a>
      </div>
    </section>
  );
}
