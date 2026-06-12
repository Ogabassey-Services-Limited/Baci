import 'server-only';
import type { ReactElement } from 'react';

/**
 * PDP static resource hints intentionally do not preload decorative or
 * below-the-fold campaign images. The canonical PDP product image owns LCP
 * priority through `preloadOgabasseyPdpProductResources`.
 */
export function preloadOgabasseyPdpStaticResources(): void {
  return;
}

export function OgabasseyPdpStaticResourceHints(): ReactElement | null {
  return null;
}
