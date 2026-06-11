'use client';

import * as ReactDOM from 'react-dom';
import { OGABASSEY_CDN_ORIGIN } from '@/components/storefront/ogabassey/config/storefront-origins';
import { OGABASSEY_HERO_DESKTOP_LCP_SRC } from '@/config/ogabassey-hero-assets';

export function OgabasseyStaticResourceHints() {
  // Next's Metadata API does not model resource hints; current Next docs
  // require these ReactDOM hint calls from a Client Component so React can
  // safely insert them into the document head during the initial render.
  ReactDOM.prefetchDNS(OGABASSEY_CDN_ORIGIN);
  ReactDOM.preconnect(OGABASSEY_CDN_ORIGIN);
  ReactDOM.preload(OGABASSEY_HERO_DESKTOP_LCP_SRC, {
    as: 'image',
    fetchPriority: 'high',
    media: '(min-width: 768px)',
    type: 'image/avif',
  });

  return null;
}
