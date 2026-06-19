'use client';

import * as ReactDOM from 'react-dom';
import { OGABASSEY_CDN_ORIGIN } from '@/components/storefront/ogabassey/config/storefront-origins';

export function OgabasseyStaticResourceHints() {
  // Next's Metadata API does not model resource hints; current Next docs
  // require these ReactDOM hint calls from a Client Component so React can
  // safely insert them into the document head during the initial render.
  ReactDOM.prefetchDNS(OGABASSEY_CDN_ORIGIN);
  ReactDOM.preconnect(OGABASSEY_CDN_ORIGIN);
  return null;
}
