'use client';

import { useEffect, useState } from 'react';
import { isSlowConnection } from '@/lib/browser-capabilities';

/**
 * Smart Speculation Rules - Progressive Enhancement
 *
 * Automatically detects browser support and network conditions
 * Only enables on modern browsers with fast connections
 *
 * Supported: Chrome 121+, Edge 121+
 * Fallback: Gracefully disabled on other browsers
 *
 * @see https://developer.chrome.com/docs/web-platform/prerender-pages
 */

interface SpeculationRule {
  /** Prefetch: fetch resources only */
  prefetch?: Array<{
    source: 'list' | 'document';
    urls?: string[];
    where?: {
      href_matches?: string;
      selector_matches?: string;
    };
    eagerness?: 'immediate' | 'eager' | 'moderate' | 'conservative';
  }>;
  /** Prerender: fully render page in background (use sparingly!) */
  prerender?: Array<{
    source: 'list' | 'document';
    urls?: string[];
    where?: {
      href_matches?: string;
      selector_matches?: string;
    };
    eagerness?: 'immediate' | 'eager' | 'moderate' | 'conservative';
  }>;
}

/**
 * Client-side wrapper to check network conditions before inserting speculation rules
 * Now CSP-safe: renders a server-side script tag instead of creating DOM elements
 */
export function SpeculationRules({ nonce }: { nonce?: string }) {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    // Only check for network conditions (Save-Data / Slow Connection)
    // Browsers natively ignore the script if they don't support Speculation Rules
    const slowNetwork = isSlowConnection();

    if (slowNetwork) {
      console.log(
        '[Baci] Speculation Rules disabled - slow connection detected (respecting user bandwidth)'
      );
      return;
    }

    setShouldRender(true);
  }, []);

  if (!shouldRender) return null;

  const rules: SpeculationRule = {
    // Prefetch: Product pages from category listings
    prefetch: [
      {
        source: 'document',
        // Prefetch all product links when they're visible
        where: { href_matches: '/products/*' },
        eagerness: 'moderate', // Prefetch when link is likely to be clicked
      },
      {
        source: 'document',
        // Prefetch category pages
        where: { href_matches: '/categories/*' },
        eagerness: 'conservative', // Only when hovering
      },
    ],
    // Prerender: Critical conversion paths (use sparingly - expensive!)
    prerender: [
      {
        source: 'list',
        // Prerender checkout from cart page - highest conversion impact
        urls: ['/checkout'],
        eagerness: 'eager', // Prerender when cart page loads
      },
    ],
  };

  return (
    <script
      type="speculationrules"
      nonce={nonce}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Speculation rules
      dangerouslySetInnerHTML={{ __html: JSON.stringify(rules) }}
    />
  );
}

/**
 * Route-specific speculation rules
 * Use these for targeted optimization on specific pages
 */

export function CartSpeculationRules({ nonce }: { nonce?: string }) {
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (
      typeof HTMLScriptElement !== 'undefined' &&
      HTMLScriptElement.supports?.('speculationrules')
    ) {
      setIsSupported(true);
    }
  }, []);

  if (!isSupported) return null;

  const rules: SpeculationRule = {
    prerender: [
      {
        source: 'list',
        // Aggressively prerender checkout - 90% of cart users go here
        urls: ['/checkout'],
        eagerness: 'immediate', // Start prerendering immediately
      },
    ],
  };

  return (
    <script
      type="speculationrules"
      nonce={nonce}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Speculation rules
      dangerouslySetInnerHTML={{ __html: JSON.stringify(rules) }}
    />
  );
}

export function ProductPageSpeculationRules({ nonce }: { nonce?: string }) {
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (
      typeof HTMLScriptElement !== 'undefined' &&
      HTMLScriptElement.supports?.('speculationrules')
    ) {
      setIsSupported(true);
    }
  }, []);

  if (!isSupported) return null;

  const rules: SpeculationRule = {
    prefetch: [
      {
        source: 'document',
        // Prefetch related products
        where: { selector_matches: '.related-products a' },
        eagerness: 'moderate',
      },
    ],
    prerender: [
      {
        source: 'list',
        // Prerender cart for high-intent users
        urls: ['/cart'],
        eagerness: 'conservative', // Only when "Add to Cart" is hovered
      },
    ],
  };

  return (
    <script
      type="speculationrules"
      nonce={nonce}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Speculation rules
      dangerouslySetInnerHTML={{ __html: JSON.stringify(rules) }}
    />
  );
}
