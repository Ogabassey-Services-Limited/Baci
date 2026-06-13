'use client';

import Script from 'next/script';
import { useSyncExternalStore } from 'react';
import { isAnalyticsAllowed } from '@/lib/analytics';

interface FacebookPixelProps {
  pixelId: string;
}

const CONSENT_STORAGE_KEY = 'baci-cookie-consent';

// Subscribe to cross-tab consent changes. React re-reads the snapshot whenever
// the listener fires, so consent updates flow in without a setState-in-effect.
function subscribeToConsent(onChange: () => void): () => void {
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === CONSENT_STORAGE_KEY) {
      onChange();
    }
  };
  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}

// Server renders with consent denied to stay deterministic during hydration.
const getConsentServerSnapshot = (): boolean => false;

export function FacebookPixel({ pixelId }: FacebookPixelProps) {
  const isAllowed = useSyncExternalStore(
    subscribeToConsent,
    isAnalyticsAllowed,
    getConsentServerSnapshot
  );

  // Don't render if no pixel ID or consent not given
  if (!pixelId || !isAllowed) {
    return null;
  }

  return (
    <>
      <Script id="facebook-pixel" strategy="lazyOnload">
        {`
                    !function(f,b,e,v,n,t,s)
                    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                    n.queue=[];t=b.createElement(e);t.async=!0;
                    t.src=v;s=b.getElementsByTagName(e)[0];
                    s.parentNode.insertBefore(t,s)}(window, document,'script',
                    'https://connect.facebook.net/en_US/fbevents.js');
                    fbq('init', '${pixelId}');
                    fbq('track', 'PageView');
                `}
      </Script>
      <noscript>
        {/* biome-ignore lint/performance/noImgElement: Tracking pixel in noscript must use standard img tag */}
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
