/**
 * Shared XML utilities for generating sitemaps.
 *
 * Used by the storefront sitemap route handler to produce valid XML
 * with image sitemap support (Google Image Sitemaps extension).
 */

/** Escape special XML characters to prevent injection / malformed output. */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface UrlEntryOptions {
  lastmod?: Date;
  changefreq?:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never';
  priority?: number;
  images?: string[];
}

/** Build a single `<url>` XML element with optional image children. */
export function buildUrlEntry(url: string, opts: UrlEntryOptions = {}): string {
  const parts: string[] = [`  <url>`, `    <loc>${escapeXml(url)}</loc>`];

  if (opts.lastmod) {
    parts.push(`    <lastmod>${opts.lastmod.toISOString()}</lastmod>`);
  }
  if (opts.changefreq) {
    parts.push(`    <changefreq>${opts.changefreq}</changefreq>`);
  }
  if (opts.priority !== undefined) {
    parts.push(`    <priority>${opts.priority}</priority>`);
  }
  if (opts.images) {
    for (const img of opts.images) {
      parts.push(
        `    <image:image>`,
        `      <image:loc>${escapeXml(img)}</image:loc>`,
        `    </image:image>`
      );
    }
  }

  parts.push(`  </url>`);
  return parts.join('\n');
}

/** Wrap URL entries in a complete sitemap XML document with xmlns declarations. */
export function buildUrlsetXml(entries: string[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...entries,
    '</urlset>',
  ].join('\n');
}
