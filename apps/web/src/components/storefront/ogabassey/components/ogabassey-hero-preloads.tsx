import {
  HERO_DESKTOP_LCP_SRC,
  HERO_MOBILE_LCP_SRC,
} from './hero-data';

// Additional home-only origins to warm before LCP image discovery. The shared
// OgaBassey layout owns the CDN warmup, and the hero slides now use local
// first-party iPhone artwork, so this intentionally remains empty.
export const OGABASSEY_HERO_PRECONNECT_ORIGINS = [] as const;

/**
 * Resource hints + viewport-scoped hero LCP preloads for OgaBassey. These
 * manual preloads avoid Next Image's unconditional `priority`/`preload` head
 * hint while still making the mobile and desktop LCP candidates discoverable
 * from the initial document. Renders only `<link>` tags; React 19 hoists them
 * to `<head>`.
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
        type="image/avif"
      />
      {/*
        Keep this as a single typed AVIF preload. A parallel JPEG preload with
        the same media query is fetched by AVIF-capable browsers too, because
        they also support JPEG. Non-AVIF clients use the carousel's <picture>
        JPEG fallback when the body is parsed.
      */}
      <link
        rel="preload"
        as="image"
        href={HERO_MOBILE_LCP_SRC}
        fetchPriority="high"
        media="(max-width: 767px)"
        type="image/avif"
      />
    </>
  );
}
