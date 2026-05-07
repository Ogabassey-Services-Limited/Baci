import {
  HERO_DESKTOP_LCP_SRC,
} from './hero-data';

// Origins the OgaBassey storefront fetches above-the-fold assets from.
// React 19 hoists these <link> tags to <head> automatically; warming the
// connection before the LCP image request is queued cuts handshake time
// off the critical path.
export const OGABASSEY_HERO_PRECONNECT_ORIGINS = [
  'https://cdn.ogabassey.com',
  'https://store.storeimages.cdn-apple.com',
] as const;

/**
 * Resource hints + the desktop hero LCP preload for OgaBassey. The mobile
 * LCP image is already preloaded by Next Image from the eager, high-priority
 * first mobile slide, so duplicating it here creates redundant preload work.
 * Renders only `<link>` tags; React 19 hoists them to `<head>`.
 *
 * Mounted from the storefront home Server Component when the slug matches
 * one of `OGABASSEY_HERO_PRELOAD_IDENTIFIERS`.
 */
export function OgabasseyHeroPreloads() {
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
      <link
        rel="preload"
        as="image"
        href={HERO_DESKTOP_LCP_SRC}
        fetchPriority="high"
        media="(min-width: 768px)"
      />
    </>
  );
}
