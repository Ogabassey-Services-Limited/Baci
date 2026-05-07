import { describe, expect, it } from 'vitest';
import { sanitizeSvg } from './sanitize-svg';

describe('sanitizeSvg', () => {
  it('returns safe SVG unchanged', () => {
    const safeSvg = '<svg><circle r="5"/></svg>';
    expect(sanitizeSvg(safeSvg)).toBe(safeSvg);
  });

  it.each([
    [
      'script tags including content',
      '<svg><script>alert("XSS")</script><circle r="5"/></svg>',
      ['<script>', 'alert'],
      '<circle r="5"/>',
    ],
    [
      'script tags with whitespace in closing tag',
      '<svg><script>alert("XSS")</script ><circle r="5"/></svg>',
      ['<script>', 'alert'],
      '<circle r="5"/>',
    ],
    [
      'self-closing script tags',
      '<svg><script src="evil.js"/><circle r="5"/></svg>',
      ['<script', 'evil.js'],
      '<circle r="5"/>',
    ],
    [
      'style tags with content',
      '<svg><style>circle { fill: red } @import url("evil.css")</style><circle r="5"/></svg>',
      ['<style', '@import'],
      '<circle r="5"/>',
    ],
    [
      'foreignObject tags',
      '<svg><foreignObject><div>Bad HTML</div></foreignObject><circle r="5"/></svg>',
      ['<foreignObject', 'Bad HTML'],
      '<circle r="5"/>',
    ],
    [
      'iframe tags',
      '<svg><iframe src="https://evil.com"></iframe><circle r="5"/></svg>',
      ['<iframe', 'evil.com'],
      '<circle r="5"/>',
    ],
    [
      'embed tags',
      '<svg><embed src="evil.swf"/><circle r="5"/></svg>',
      ['<embed', 'evil.swf'],
      '<circle r="5"/>',
    ],
    [
      'object tags',
      '<svg><object data="evil.swf"></object><circle r="5"/></svg>',
      ['<object', 'evil.swf'],
      '<circle r="5"/>',
    ],
    [
      'external use href references',
      '<svg><use href="https://evil.com/icon.svg#bad"/><circle r="5"/></svg>',
      ['<use', 'evil.com'],
      '<circle r="5"/>',
    ],
    [
      'external use xlink references',
      '<svg><use xlink:href="https://evil.com/icon.svg#bad"/><circle r="5"/></svg>',
      ['<use', 'evil.com'],
      '<circle r="5"/>',
    ],
    [
      'protocol-relative use references',
      '<svg><use href="//evil.com/icon.svg#bad"/><circle r="5"/></svg>',
      ['<use', 'evil.com'],
      '<circle r="5"/>',
    ],
  ])('removes %s', (_label, input, absentValues, presentValue) => {
    const result = sanitizeSvg(input);

    for (const absentValue of absentValues) {
      expect(result).not.toContain(absentValue);
    }
    expect(result).toContain(presentValue);
  });

  it.each([
    ['onerror', '<svg><image src="x" onerror="alert(1)"/></svg>', '<image'],
    [
      'onclick',
      '<svg><circle r="5" onclick="alert(\'XSS\')"/></svg>',
      '<circle',
    ],
    ['onload', '<svg onload="alert(\'XSS\')"><circle r="5"/></svg>', '<circle'],
  ])('removes %s event handlers', (attributeName, input, safeContent) => {
    const result = sanitizeSvg(input);

    expect(result).not.toContain(attributeName);
    expect(result).not.toContain('alert');
    expect(result).toContain(safeContent);
  });

  it('removes multiple different event handlers', () => {
    const result = sanitizeSvg(
      '<svg onload="a()" onclick="b()" onmouseover="c()"><circle r="5"/></svg>'
    );

    expect(result).not.toContain('onload');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onmouseover');
    expect(result).toContain('<circle r="5"/>');
  });

  it('preserves internal use references', () => {
    const result = sanitizeSvg(
      '<svg><defs><circle id="s" r="5"/></defs><use href="#s"/></svg>'
    );

    expect(result).toContain('href="#s"');
    expect(result).toContain('<defs>');
  });

  it.each([
    [
      'javascript href',
      '<svg><a href="javascript:alert(\'XSS\')"><circle r="5"/></a></svg>',
      'href=""',
    ],
    [
      'javascript xlink:href',
      '<svg><a xlink:href="javascript:alert(\'XSS\')"><circle r="5"/></a></svg>',
      'xlink:href=""',
    ],
    [
      'vbscript href',
      '<svg><a href="vbscript:msgbox(\'XSS\')"><circle r="5"/></a></svg>',
      'href=""',
    ],
    [
      'data href',
      '<svg><a href="data:text/html,<script>alert(\'XSS\')</script>"><circle r="5"/></a></svg>',
      'href=""',
    ],
    [
      'data xlink:href',
      '<svg><image xlink:href="data:image/svg+xml,<script>alert(\'XSS\')</script>"/></svg>',
      'xlink:href=""',
    ],
    [
      'data src',
      '<svg><image src="data:image/svg+xml,<script>alert(\'XSS\')</script>"/></svg>',
      'src=""',
    ],
  ])('replaces unsafe %s URIs', (_label, input, sanitizedAttribute) => {
    const result = sanitizeSvg(input);

    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('vbscript:');
    expect(result).not.toContain('data:');
    expect(result).not.toContain('alert');
    expect(result).not.toContain('msgbox');
    expect(result).toContain(sanitizedAttribute);
  });

  it('prevents nested reconstruction via iterative stripping', () => {
    const result = sanitizeSvg(
      '<svg><scr<script>ipt>alert("XSS")</scr</script>ipt><circle r="5"/></svg>'
    );

    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
    expect(result).toContain('<circle r="5"/>');
  });

  it('is idempotent', () => {
    const maliciousSvg =
      '<svg><script>alert("XSS")</script><circle r="5" onclick="bad()"/></svg>';
    const firstPass = sanitizeSvg(maliciousSvg);

    expect(sanitizeSvg(firstPass)).toBe(firstPass);
    expect(firstPass).not.toContain('<script>');
    expect(firstPass).not.toContain('onclick');
  });

  it('handles complex real-world attack vectors', () => {
    const result = sanitizeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <script>alert('XSS')</script>
        <foreignObject><iframe src="https://evil.com"></iframe></foreignObject>
        <use xlink:href="https://evil.com/icon.svg#attack"/>
        <circle r="10" onclick="steal()" onload="hijack()"/>
        <a href="javascript:void(alert('XSS'))">Click me</a>
        <image xlink:href="data:image/svg+xml,<svg onload='alert(1)'/>"/>
        <circle r="5" fill="#00ff00"/>
      </svg>
    `);

    for (const blocked of [
      '<script>',
      '<foreignObject',
      '<iframe',
      '<use',
      'onclick',
      'onload',
      'javascript:',
      'data:',
    ]) {
      expect(result).not.toContain(blocked);
    }
    expect(result).toContain('<circle r="5" fill="#00ff00"/>');
  });

  it('removes variations of script tags with different case and whitespace', () => {
    const result = sanitizeSvg(
      '<svg><SCRIPT>alert(1)</SCRIPT><Script>alert(2)</Script><circle r="5"/></svg>'
    );

    expect(result).not.toMatch(/<script/i);
    expect(result).not.toContain('alert');
    expect(result).toContain('<circle r="5"/>');
  });

  it('does not remove tag names that only start with dangerous prefixes', () => {
    const result = sanitizeSvg(
      '<svg><embedded data-safe="1"></embedded><circle r="5"/></svg>'
    );

    expect(result).toContain('<embedded data-safe="1"></embedded>');
    expect(result).toContain('<circle r="5"/>');
  });

  it('handles empty and invalid inputs consistently', () => {
    expect(sanitizeSvg('<svg></svg>')).toBe('<svg></svg>');
    expect(sanitizeSvg('')).toBe('');
    expect(() => sanitizeSvg(null as unknown as string)).toThrow();
    expect(() => sanitizeSvg(undefined as unknown as string)).toThrow();
  });

  it('preserves safe SVG attributes and elements', () => {
    const result = sanitizeSvg(`
      <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="40" fill="blue" stroke="black" stroke-width="2"/>
        <rect x="10" y="10" width="30" height="30" fill="red"/>
        <path d="M 10 10 L 90 90" stroke="green"/>
        <text x="50" y="50" font-size="16" text-anchor="middle">Hello</text>
        <g transform="translate(10,10)"><circle r="5"/></g>
      </svg>
    `);

    for (const safeContent of [
      '<circle',
      '<rect',
      '<path',
      '<text',
      '<g',
      'viewBox',
      'fill="blue"',
      'stroke="black"',
    ]) {
      expect(result).toContain(safeContent);
    }
  });
});
