import { describe, expect, it } from 'vitest';
import { sanitizeSvg } from './generate-receipt-html';

describe('sanitizeSvg', () => {
  it('preserves safe SVG elements', () => {
    const safeSvg = '<svg><circle r="5"></circle></svg>';
    const result = sanitizeSvg(safeSvg);
    expect(result).toContain('<svg');
    expect(result).toContain('circle');
    expect(result).toContain('r="5"');
  });

  it('removes <script> tags including content', () => {
    const result = sanitizeSvg(
      '<svg><script>alert("XSS")</script><circle r="5"></circle></svg>'
    );
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
    expect(result).toContain('circle');
  });

  it('removes self-closing script tags', () => {
    const result = sanitizeSvg(
      '<svg><script src="evil.js"/><circle r="5"></circle></svg>'
    );
    expect(result).not.toContain('<script');
    expect(result).not.toContain('evil.js');
    expect(result).toContain('circle');
  });

  it('removes <foreignObject> tags and content', () => {
    const result = sanitizeSvg(
      '<svg><foreignObject><div>Bad HTML</div></foreignObject><circle r="5"></circle></svg>'
    );
    expect(result).not.toContain('<foreignObject');
    expect(result).toContain('circle');
  });

  it('removes <iframe> tags', () => {
    const result = sanitizeSvg(
      '<svg><iframe src="https://evil.com"></iframe><circle r="5"></circle></svg>'
    );
    expect(result).not.toContain('<iframe');
    expect(result).not.toContain('evil.com');
    expect(result).toContain('circle');
  });

  it('removes <embed> tags', () => {
    const result = sanitizeSvg(
      '<svg><embed src="evil.swf"/><circle r="5"></circle></svg>'
    );
    expect(result).not.toContain('<embed');
    expect(result).not.toContain('evil.swf');
    expect(result).toContain('circle');
  });

  it('removes <object> tags', () => {
    const result = sanitizeSvg(
      '<svg><object data="evil.swf"></object><circle r="5"></circle></svg>'
    );
    expect(result).not.toContain('<object');
    expect(result).not.toContain('evil.swf');
    expect(result).toContain('circle');
  });

  it('removes event handlers like onerror', () => {
    const result = sanitizeSvg(
      '<svg><image src="x" onerror="alert(1)"></image></svg>'
    );
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('alert');
  });

  it('removes onclick event handler', () => {
    const result = sanitizeSvg(
      '<svg><circle r="5" onclick="alert(\'XSS\')"></circle></svg>'
    );
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('alert');
    expect(result).toContain('circle');
  });

  it('removes onload event handler', () => {
    const result = sanitizeSvg(
      '<svg onload="alert(\'XSS\')"><circle r="5"></circle></svg>'
    );
    expect(result).not.toContain('onload');
    expect(result).not.toContain('alert');
    expect(result).toContain('circle');
  });

  it('removes multiple event handlers', () => {
    const result = sanitizeSvg(
      '<svg onload="a()" onclick="b()" onmouseover="c()"><circle r="5"></circle></svg>'
    );
    expect(result).not.toContain('onload');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onmouseover');
    expect(result).toContain('circle');
  });

  it('removes javascript: URIs in href', () => {
    const result = sanitizeSvg(
      '<svg><a href="javascript:alert(\'XSS\')"><circle r="5"></circle></a></svg>'
    );
    expect(result).not.toContain('javascript:');
    expect(result).toContain('circle');
  });

  it('removes data: URIs in href', () => {
    const result = sanitizeSvg(
      '<svg><a href="data:text/html,<script>alert(1)</script>"><circle r="5"></circle></a></svg>'
    );
    expect(result).not.toMatch(/href="data:/i);
    expect(result).toContain('circle');
  });

  it('preserves internal <use> references', () => {
    const result = sanitizeSvg(
      '<svg><defs><circle id="s" r="5"></circle></defs><use href="#s"></use></svg>'
    );
    expect(result).toContain('href="#s"');
    expect(result).toContain('defs');
  });

  it('is idempotent - calling twice gives same result', () => {
    const input =
      '<svg><script>alert("XSS")</script><circle r="5" onclick="bad()"></circle></svg>';
    const firstPass = sanitizeSvg(input);
    const secondPass = sanitizeSvg(firstPass);
    expect(firstPass).toBe(secondPass);
    expect(secondPass).not.toContain('<script');
    expect(secondPass).not.toContain('onclick');
  });

  it('handles complex real-world attack vectors', () => {
    const complexAttack = `
      <svg xmlns="http://www.w3.org/2000/svg">
        <script>alert('XSS')</script>
        <foreignObject width="100" height="100">
          <div xmlns="http://www.w3.org/1999/xhtml">
            <iframe src="https://evil.com"></iframe>
          </div>
        </foreignObject>
        <circle r="10" onclick="steal()" onload="hijack()"></circle>
        <a href="javascript:void(alert('XSS'))">Click me</a>
        <circle r="5" fill="#00ff00"></circle>
      </svg>
    `;
    const result = sanitizeSvg(complexAttack);

    expect(result).not.toContain('<script');
    expect(result).not.toContain('<foreignObject');
    expect(result).not.toContain('<iframe');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onload');
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('evil.com');

    expect(result).toContain('fill="#00ff00"');
  });

  it('removes script tags with different case', () => {
    const result = sanitizeSvg(
      '<svg><SCRIPT>alert(1)</SCRIPT><circle r="5"></circle></svg>'
    );
    expect(result).not.toMatch(/<script/i);
    expect(result).not.toContain('alert');
    expect(result).toContain('circle');
  });

  it('handles empty SVG', () => {
    const result = sanitizeSvg('<svg></svg>');
    expect(result).toContain('<svg');
  });

  it('throws when called with null', () => {
    expect(() => sanitizeSvg(null as unknown as string)).toThrow();
  });

  it('throws when called with undefined', () => {
    expect(() => sanitizeSvg(undefined as unknown as string)).toThrow();
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeSvg('')).toBe('');
  });

  it('preserves safe SVG attributes and elements', () => {
    const safeSvg = `
      <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="40" fill="blue" stroke="black" stroke-width="2"></circle>
        <rect x="10" y="10" width="30" height="30" fill="red"></rect>
        <path d="M 10 10 L 90 90" stroke="green"></path>
        <text x="50" y="50" font-size="16" text-anchor="middle">Hello</text>
        <g transform="translate(10,10)">
          <circle r="5"></circle>
        </g>
      </svg>
    `;
    const result = sanitizeSvg(safeSvg);

    expect(result).toContain('circle');
    expect(result).toContain('rect');
    expect(result).toContain('path');
    expect(result).toContain('text');
    expect(result).toContain('<g');
    expect(result).toContain('viewBox');
    expect(result).toContain('fill="blue"');
    expect(result).toContain('stroke="black"');
  });
});
