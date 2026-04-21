import { defineConfig } from '@unlighthouse/core';
import { getUnlighthousePuppeteerOptions } from './unlighthouse-puppeteer-options';

export default defineConfig({
  // Koray Tuğberk GÜBÜR Style: Holistic SEO Audit
  // We prioritize mobile performance as Google uses mobile-first indexing.

  scanner: {
    // Simulate real mobile device
    device: 'mobile',
    // Next.js relies on JS, so we must execute it
    skipJavascript: false,
    // Scan up to 50 pages to get a good representative sample
    samples: 50,
  },

  // Performance thresholds (Core Web Vitals 2025)
  // We want to fail if scores are too low
  ci: {
    budget: {
      performance: 80,
      accessibility: 95, // Strict on Accessibility for WCAG compliance
      'best-practices': 90,
      seo: 100, // Zero tolerance for SEO errors
    },
  },

  puppeteerOptions: getUnlighthousePuppeteerOptions(),

  // Discoverability
  // Use defaults for best results

  debug: true,
});
