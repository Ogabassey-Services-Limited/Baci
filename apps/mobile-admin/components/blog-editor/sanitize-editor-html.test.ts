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

  it('neutralizes dangerous unquoted href and src attributes', () => {
    const dirtyHtml =
      '<a href=javascript:alert(1)>Click</a><img src=data:text/html,alert(1)>';

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

  it('preserves safe YouTube embeds', () => {
    const safeHtml =
      '<div class="video-container"><iframe src="https://www.youtube.com/embed/ABCDEFGHIJK" allowfullscreen></iframe></div>';

    expect(sanitizeEditorHtml(safeHtml)).toBe(
      '<div class="video-container"><iframe src="https://www.youtube.com/embed/ABCDEFGHIJK" allowfullscreen></iframe></div>'
    );
  });

  it('preserves safe YouTube embeds for supported host variants', () => {
    expect(
      sanitizeEditorHtml(
        '<iframe src="https://youtube.com/embed/ABCDEFGHIJK"></iframe>'
      )
    ).toBe(
      '<iframe src="https://youtube.com/embed/ABCDEFGHIJK" allowfullscreen></iframe>'
    );

    expect(
      sanitizeEditorHtml(
        '<iframe src="https://www.youtube-nocookie.com/embed/ABCDEFGHIJK"></iframe>'
      )
    ).toBe(
      '<iframe src="https://www.youtube-nocookie.com/embed/ABCDEFGHIJK" allowfullscreen></iframe>'
    );

    expect(
      sanitizeEditorHtml(
        '<iframe src="https://www.youtube.com/embed/ABCDEFGHIJK?autoplay=1&mute=1"></iframe>'
      )
    ).toBe(
      '<iframe src="https://www.youtube.com/embed/ABCDEFGHIJK" allowfullscreen></iframe>'
    );

    expect(
      sanitizeEditorHtml(
        '<iframe src="https://www.YouTube.com/embed/ABCDEFGHIJK"></iframe>'
      )
    ).toBe(
      '<iframe src="https://www.youtube.com/embed/ABCDEFGHIJK" allowfullscreen></iframe>'
    );
  });

  it('removes unsafe iframe embeds while preserving the surrounding content', () => {
    const dirtyHtml =
      '<div class="video-container"><iframe src="https://example.com/embed/ABCDEFGHIJK"></iframe></div><p>Keep me</p>';

    expect(sanitizeEditorHtml(dirtyHtml)).toBe(
      '<div class="video-container"></div><p>Keep me</p>'
    );
  });

  it('removes iframe variants that do not expose a safe YouTube src', () => {
    const dirtyHtml =
      '<iframe srcdoc="<p>Injected</p>"></iframe><p>Keep me</p>';

    expect(sanitizeEditorHtml(dirtyHtml)).toBe('<p>Keep me</p>');
  });
});
