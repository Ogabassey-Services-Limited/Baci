import {
  HERO_DESKTOP_LCP_SRC,
  HERO_MOBILE_LCP_SRC,
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
 * Resource hints + viewport-conditional preloads for the OgaBassey hero LCP
 * image. Renders only `<link>` tags; React 19 hoists them to `<head>`.
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
      <link
        rel="preload"
        as="image"
        href={HERO_MOBILE_LCP_SRC}
        fetchPriority="high"
        media="(max-width: 767px)"
      />
    </>
  );
}
