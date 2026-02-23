import { describe, expect, it } from 'vitest';
import { buildUrlEntry, buildUrlsetXml, escapeXml } from './sitemap-xml';

describe('escapeXml', () => {
  it('escapes ampersand', () => {
    expect(escapeXml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('escapes angle brackets', () => {
    expect(escapeXml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double quotes', () => {
    expect(escapeXml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeXml("it's")).toBe('it&apos;s');
  });

  it('escapes all special characters together', () => {
    expect(escapeXml('a & b < c > d "e" \'f\'')).toBe(
      'a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;'
    );
  });

  it('returns unchanged string when no special characters', () => {
    expect(escapeXml('https://ogabassey.com/products')).toBe(
      'https://ogabassey.com/products'
    );
  });
});

describe('buildUrlEntry', () => {
  it('generates url element with only loc', () => {
    const xml = buildUrlEntry('https://ogabassey.com');
    expect(xml).toContain('<url>');
    expect(xml).toContain('<loc>https://ogabassey.com</loc>');
    expect(xml).toContain('</url>');
    expect(xml).not.toContain('<lastmod>');
    expect(xml).not.toContain('<changefreq>');
    expect(xml).not.toContain('<priority>');
  });

  it('includes lastmod when provided', () => {
    const date = new Date('2026-01-15T00:00:00Z');
    const xml = buildUrlEntry('https://ogabassey.com', { lastmod: date });
    expect(xml).toContain('<lastmod>2026-01-15T00:00:00.000Z</lastmod>');
  });

  it('includes changefreq when provided', () => {
    const xml = buildUrlEntry('https://ogabassey.com', { changefreq: 'daily' });
    expect(xml).toContain('<changefreq>daily</changefreq>');
  });

  it('includes priority when provided', () => {
    const xml = buildUrlEntry('https://ogabassey.com', { priority: 0.8 });
    expect(xml).toContain('<priority>0.8</priority>');
  });

  it('includes priority 0', () => {
    const xml = buildUrlEntry('https://ogabassey.com', { priority: 0 });
    expect(xml).toContain('<priority>0</priority>');
  });

  it('includes all optional fields', () => {
    const xml = buildUrlEntry('https://ogabassey.com/phones', {
      lastmod: new Date('2026-02-01T00:00:00Z'),
      changefreq: 'weekly',
      priority: 0.7,
    });
    expect(xml).toContain('<loc>https://ogabassey.com/phones</loc>');
    expect(xml).toContain('<lastmod>2026-02-01T00:00:00.000Z</lastmod>');
    expect(xml).toContain('<changefreq>weekly</changefreq>');
    expect(xml).toContain('<priority>0.7</priority>');
  });

  it('includes image:image tags', () => {
    const xml = buildUrlEntry('https://ogabassey.com/products/iphone', {
      images: [
        'https://img.example.com/iphone-front.jpg',
        'https://img.example.com/iphone-back.jpg',
      ],
    });
    expect(xml).toContain('<image:image>');
    expect(xml).toContain(
      '<image:loc>https://img.example.com/iphone-front.jpg</image:loc>'
    );
    expect(xml).toContain(
      '<image:loc>https://img.example.com/iphone-back.jpg</image:loc>'
    );
    expect(xml).toContain('</image:image>');
  });

  it('escapes special characters in URL', () => {
    const xml = buildUrlEntry(
      'https://ogabassey.com/search?q=phone&brand=apple'
    );
    expect(xml).toContain(
      '<loc>https://ogabassey.com/search?q=phone&amp;brand=apple</loc>'
    );
  });
});

describe('buildUrlsetXml', () => {
  it('produces valid XML document with declarations', () => {
    const xml = buildUrlsetXml([]);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain(
      'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'
    );
    expect(xml).toContain(
      'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
    );
    expect(xml).toContain('</urlset>');
  });

  it('wraps entries in urlset', () => {
    const entry = buildUrlEntry('https://ogabassey.com', { priority: 1 });
    const xml = buildUrlsetXml([entry]);
    expect(xml).toContain('<urlset');
    expect(xml).toContain('<url>');
    expect(xml).toContain('<loc>https://ogabassey.com</loc>');
    expect(xml).toContain('</urlset>');
  });

  it('includes multiple entries', () => {
    const entries = [
      buildUrlEntry('https://ogabassey.com'),
      buildUrlEntry('https://ogabassey.com/phones'),
      buildUrlEntry('https://ogabassey.com/blog'),
    ];
    const xml = buildUrlsetXml(entries);
    const urlCount = (xml.match(/<url>/g) || []).length;
    expect(urlCount).toBe(3);
  });

  it('does not contain HTML tags', () => {
    const xml = buildUrlsetXml([buildUrlEntry('https://ogabassey.com')]);
    expect(xml).not.toContain('<!DOCTYPE html');
    expect(xml).not.toContain('<html');
  });
});
