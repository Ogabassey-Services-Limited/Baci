import { describe, expect, it } from 'vitest';
import { processFavicon, sanitizeSVG } from './favicon-processor';

describe('sanitizeSVG', () => {
  it('preserves valid SVG content', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"/></svg>';
    const result = sanitizeSVG(svg);
    expect(result).toContain('<svg');
    expect(result).toContain('<circle');
    expect(result).toContain('fill="red"');
  });

  it('strips script tags from SVG', () => {
    const malicious =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script><rect width="100" height="100"/></svg>';
    const result = sanitizeSVG(malicious);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
    expect(result).toContain('<rect');
  });

  it('strips event handler attributes', () => {
    const malicious =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="alert(1)" width="100" height="100"/></svg>';
    const result = sanitizeSVG(malicious);
    expect(result).not.toContain('onclick');
  });

  it('strips onload and onerror handlers', () => {
    const malicious =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect onerror="alert(2)" width="100" height="100"/></svg>';
    const result = sanitizeSVG(malicious);
    expect(result).not.toContain('onload');
    expect(result).not.toContain('onerror');
  });

  it('strips foreign content (iframe, object)', () => {
    const malicious =
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><iframe src="evil.com"></iframe></foreignObject></svg>';
    const result = sanitizeSVG(malicious);
    expect(result).not.toContain('<iframe');
    expect(result).not.toContain('<foreignObject');
  });

  it('strips javascript: URLs from use href', () => {
    const malicious =
      '<svg xmlns="http://www.w3.org/2000/svg"><use href="javascript:alert(1)"/></svg>';
    const result = sanitizeSVG(malicious);
    expect(result).not.toContain('javascript:');
  });

  it('strips data: URLs from use href', () => {
    const malicious =
      '<svg xmlns="http://www.w3.org/2000/svg"><use href="data:text/html,<script>alert(1)</script>"/></svg>';
    const result = sanitizeSVG(malicious);
    expect(result).not.toContain('data:');
  });

  it('preserves gradient elements', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g1"><stop offset="0" stop-color="red"/></linearGradient></defs></svg>';
    const result = sanitizeSVG(svg);
    expect(result).toContain('linearGradient');
    expect(result).toContain('stop');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeSVG('')).toBe('');
  });
});

describe('processFavicon', () => {
  it('validates merchantId format', async () => {
    const file = new File(['<svg></svg>'], 'icon.svg', {
      type: 'image/svg+xml',
    });

    await expect(processFavicon(file, '../traversal')).rejects.toThrow(
      'Invalid merchant ID format'
    );
    await expect(processFavicon(file, '')).rejects.toThrow(
      'Invalid merchant ID format'
    );
    await expect(processFavicon(file, 'not-a-uuid')).rejects.toThrow(
      'Invalid merchant ID format'
    );
  });
});
