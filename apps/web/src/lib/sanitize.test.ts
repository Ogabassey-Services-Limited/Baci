import { describe, expect, it } from 'vitest';
import { escapeHtmlText, sanitizeHtml, sanitizeSvg } from './sanitize';

describe('sanitize', () => {
  it('removes unsafe scripts and javascript URLs from HTML', () => {
    const input =
      '<p>Hello</p><script>alert(1)</script><a href="javascript:alert(1)">Click</a>';

    const output = sanitizeHtml(input);

    expect(output).toContain('<p>Hello</p>');
    expect(output).not.toContain('<script');
    expect(output).not.toContain('javascript:');
  });

  it('keeps safe links and adds rel protection', () => {
    const output = sanitizeHtml('<a href="https://example.com">Safe</a>');

    expect(output).toContain('href="https://example.com"');
    expect(output).toContain('rel="noopener noreferrer"');
  });

  it('coerces heading offsets to safe finite integers', () => {
    expect(
      sanitizeHtml('<h1>Title</h1>', { headingLevelOffset: 1.9 })
    ).toContain('<h2>Title</h2>');
    expect(
      sanitizeHtml('<h1>Title</h1>', {
        headingLevelOffset: Number.POSITIVE_INFINITY,
      })
    ).toContain('<h1>Title</h1>');
  });

  it('removes active content from SVG', () => {
    const input =
      '<svg viewBox="0 0 16 16" onload="alert(1)"><script>alert(1)</script><circle cx="8" cy="8" r="6" /></svg>';

    const output = sanitizeSvg(input);

    expect(output).toContain('<circle');
    expect(output).not.toContain('<script');
    expect(output).not.toContain('onload=');
  });

  it('preserves case-sensitive SVG attributes', () => {
    const output = sanitizeSvg(
      '<svg viewBox="0 0 32 32"><path d="M0 0h32v32H0z" /></svg>'
    );

    expect(output).toContain('viewBox="0 0 32 32"');
  });

  it('escapes plain text without dropping literal angle-bracket content', () => {
    const output = escapeHtmlText('TGW <Store> & "quotes"');

    expect(output).toBe('TGW &lt;Store&gt; &amp; "quotes"');
  });
});
