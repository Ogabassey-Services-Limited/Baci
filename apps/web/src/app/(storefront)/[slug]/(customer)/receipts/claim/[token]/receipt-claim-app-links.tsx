'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  OGABASSEY_STOREFRONT_APP_STORE_URL,
  OGABASSEY_STOREFRONT_PLAY_STORE_URL,
} from '@/config/platform';
import { fetchWithCsrf } from '@/lib/api-client';
import type { ReceiptClaimAppDownloadTarget } from '@/lib/import-notifications/receipt-claim-preview';

interface ReceiptClaimAppLinksProps {
  token: string;
}

export default function ReceiptClaimAppLinks({
  token,
}: ReceiptClaimAppLinksProps) {
  const appDownloadTrackingPath = `/api/storefront/receipts/claims/${encodeURIComponent(token)}/app-download-click`;

  function trackAppDownloadClick(target: ReceiptClaimAppDownloadTarget) {
    if (!token) {
      return;
    }

    void fetchWithCsrf(appDownloadTrackingPath, {
      body: JSON.stringify({ target }),
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      keepalive: true,
      method: 'POST',
    }).catch(() => undefined);
  }

  return (
    <div className="space-y-3 rounded-md border border-store-border bg-store-secondary/40 p-4">
      <p className="text-sm font-medium text-store-background-text">
        Open in the Ogabassey app
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button asChild className="border-store-border" variant="outline">
          <a
            href={OGABASSEY_STOREFRONT_APP_STORE_URL}
            onClick={() => trackAppDownloadClick('app_store')}
            rel="noopener noreferrer"
            target="_blank"
          >
            <Download aria-hidden="true" className="size-4" />
            App Store
          </a>
        </Button>
        <Button asChild className="border-store-border" variant="outline">
          <a
            href={OGABASSEY_STOREFRONT_PLAY_STORE_URL}
            onClick={() => trackAppDownloadClick('play_store')}
            rel="noopener noreferrer"
            target="_blank"
          >
            <Download aria-hidden="true" className="size-4" />
            Google Play
          </a>
        </Button>
      </div>
    </div>
  );
}
