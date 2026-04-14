import { describe, expect, it } from 'vitest';
import { sanitizeEditorHtml } from '@/components/blog-editor/sanitize-editor-html';

describe('sanitize-editor-html', () => {
  it('removes blocked tags and inline event handlers', () => {
    const dirtyHtml =
      '<p onclick="alert(1)">Hello</p><script>alert(1)</script><img src="https://cdn.usebaci.com/image.png" onerror="alert(2)">';

    expect(sanitizeEditorHtml(dirtyHtml)).toBe(
      '<p>Hello</p><img src="https://cdn.usebaci.com/image.png">'
    );
  });

  it('neutralizes dangerous href and src attributes', () => {
    const dirtyHtml =
      '<a href="javascript:alert(1)">Click</a><img src="data:text/html,<script>alert(1)</script>">';

    expect(sanitizeEditorHtml(dirtyHtml)).toBe(
      '<a href="#">Click</a><img src="">'
    );
  });

  it('removes blocked tags and handlers across additional XSS vectors', () => {
    const dirtyHtml =
      '<SVG onload="alert(1)"></SVG><iframe src="javascript:alert(2)"></iframe><p ONFOCUS="alert(3)" onmouseover="alert(4)">Safe text</p><a href="vbscript:msgbox(1)">Link</a>';

    expect(sanitizeEditorHtml(dirtyHtml)).toBe(
      '<SVG></SVG><p>Safe text</p><a href="#">Link</a>'
    );
  });
});
