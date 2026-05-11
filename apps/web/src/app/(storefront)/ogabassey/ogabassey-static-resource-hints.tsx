'use client';

import * as ReactDOM from 'react-dom';
import {
  HERO_DESKTOP_LCP_SRC,
  HERO_MOBILE_LCP_SRC,
} from '@/components/storefront/ogabassey/components/hero-data';
import { OGABASSEY_CDN_ORIGIN } from '@/components/storefront/ogabassey/config/storefront-origins';

export function OgabasseyStaticResourceHints() {
  // Next.js documents these as render-time client component calls; moving them
  // to useEffect would delay LCP discovery until after hydration.
  ReactDOM.prefetchDNS(OGABASSEY_CDN_ORIGIN);
  ReactDOM.preconnect(OGABASSEY_CDN_ORIGIN);
  ReactDOM.preload(HERO_DESKTOP_LCP_SRC, {
    as: 'image',
    fetchPriority: 'high',
    media: '(min-width: 768px)',
    type: 'image/avif',
  });
  ReactDOM.preload(HERO_MOBILE_LCP_SRC, {
    as: 'image',
    fetchPriority: 'high',
    media: '(max-width: 767px)',
    type: 'image/avif',
  });

  return null;
}
