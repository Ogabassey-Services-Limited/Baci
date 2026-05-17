import 'server-only';
import * as ReactDOM from 'react-dom';
import {
  HERO_DESKTOP_LCP_SRC,
  HERO_MOBILE_LCP_SRC,
} from '@/components/storefront/ogabassey/components/hero-data';
import { OGABASSEY_CDN_ORIGIN } from '@/components/storefront/ogabassey/config/storefront-origins';

export function OgabasseyStaticResourceHints() {
  // Keep these calls in a Server Component so React can emit the resource
  // hints in the initial document head before the hero markup is parsed.
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
    type: 'image/avif',
  });

  return null;
}
