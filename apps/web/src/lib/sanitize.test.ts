import { describe, expect, it } from 'vitest';
import {
  escapeHtmlAttribute,
  escapeHtmlText,
  sanitizeHtml,
  sanitizeSvg,
} from '@/lib/sanitize';

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

  it('preserves semantic figure and figcaption markup', () => {
    const output = sanitizeHtml(
      '<figure><img src="https://example.com/photo.jpg" alt="Camera"><figcaption>Camera sample</figcaption></figure>'
    );

    expect(output).toContain('<figure>');
    expect(output).toContain('<figcaption>Camera sample</figcaption>');
  });

  it('sanitizes unsafe caption markup while keeping figcaption', () => {
    const output = sanitizeHtml(
      '<figure><img src="https://example.com/photo.jpg"><figcaption><img src=x onerror=alert(1)>Caption<script>alert(1)</script></figcaption></figure>'
    );

    expect(output).toContain('<figcaption>');
    expect(output).toContain('Caption');
    expect(output).not.toContain('onerror=');
    expect(output).not.toContain('<script');
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

  it('preserves single quotes and escapes angle brackets in plain text content', () => {
    const output = escapeHtmlText("Baci's <Store>");

    expect(output).toBe("Baci's &lt;Store&gt;");
  });

  it('escapes quotes for safe HTML attribute interpolation', () => {
    const output = escapeHtmlAttribute(`"Baci's" & <Store>`);

    expect(output).toBe('&quot;Baci&#39;s&quot; &amp; &lt;Store&gt;');
  });
});
