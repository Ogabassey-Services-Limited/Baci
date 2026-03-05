import { describe, expect, it } from 'vitest';
import { sanitizeHtml, sanitizeSvg } from './sanitize';

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
});
