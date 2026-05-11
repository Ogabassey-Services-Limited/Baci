import { preload } from 'react-dom';
import {
  HERO_DESKTOP_LCP_SRC,
  HERO_MOBILE_LCP_SRC,
} from './hero-data';

// Additional home-only origins to warm before LCP image discovery. The shared
// OgaBassey layout owns the CDN warmup, and the hero slides now use local
// first-party iPhone artwork, so this intentionally remains empty.
export const OGABASSEY_HERO_PRECONNECT_ORIGINS = [] as const;

export function OgabasseyHeroPreloads() {
  // Use React 19 resource-hint APIs so Next can flush these from streamed
  // Server Components instead of treating them as ordinary body links.
  preload(HERO_DESKTOP_LCP_SRC, {
    as: 'image',
    fetchPriority: 'high',
    media: '(min-width: 768px)',
    type: 'image/avif',
  });
  preload(HERO_MOBILE_LCP_SRC, {
    as: 'image',
    fetchPriority: 'high',
    media: '(max-width: 767px)',
    type: 'image/avif',
  });

  return (
    <>
      {OGABASSEY_HERO_PRECONNECT_ORIGINS.map((origin) => (
        <link key={`dns-${origin}`} rel="dns-prefetch" href={origin} />
      ))}
      {/*
        No `crossOrigin` attribute: Next.js <Image> requests these assets
        without CORS, so preconnecting with crossorigin would open a
        CORS-specific connection pool that the actual <img> GETs cannot
        reuse, defeating the warmup. Match the request mode of the fetch.
      */}
      {OGABASSEY_HERO_PRECONNECT_ORIGINS.map((origin) => (
        <link key={`preconnect-${origin}`} rel="preconnect" href={origin} />
      ))}
    </>
  );
}
