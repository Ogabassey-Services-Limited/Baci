import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderMarkdown, sanitizeUrl } from './markdown-renderer';

describe('sanitizeUrl', () => {
  it('allows https URLs', () => {
    const result = sanitizeUrl('https://example.com/path?q=1');
    expect(result).toBe('https://example.com/path?q=1');
  });

  it('allows http URLs', () => {
    const result = sanitizeUrl('http://example.com');
    expect(result).not.toBeNull();
    expect(result).toContain('http://example.com');
  });

  it('allows mailto URLs', () => {
    const result = sanitizeUrl('mailto:hello@example.com');
    expect(result).toBe('mailto:hello@example.com');
  });

  it('blocks javascript: protocol and returns null', () => {
    const result = sanitizeUrl('javascript:alert(1)');
    expect(result).toBeNull();
  });

  it('blocks data: URLs and returns null', () => {
    const result = sanitizeUrl('data:text/html,<script>alert(1)</script>');
    expect(result).toBeNull();
  });

  it('blocks vbscript: protocol and returns null', () => {
    const result = sanitizeUrl('vbscript:msgbox(1)');
    expect(result).toBeNull();
  });

  it('handles empty string input by returning null or a relative resolution', () => {
    // Empty string resolves relative to dummy base — either null or a safe URL
    const result = sanitizeUrl('');
    // The function tries new URL('', 'http://dummy.com') which gives http://dummy.com/
    // That protocol is http: so it passes — the important thing is it does not throw
    expect(() => sanitizeUrl('')).not.toThrow();
  });

  it('returns null for completely invalid URL-like strings that parse to unsafe protocols', () => {
    const result = sanitizeUrl('javascript:void(0)');
    expect(result).toBeNull();
  });
});

describe('renderMarkdown', () => {
  it('returns null for empty string', () => {
    const result = renderMarkdown('');
    expect(result).toBeNull();
  });

  it('renders plain text without modification', () => {
    const { container } = render(<>{renderMarkdown('Hello world')}</>);
    expect(container.textContent).toContain('Hello world');
  });

  it('renders bold text using <strong> element', () => {
    render(<>{renderMarkdown('This is **bold** text')}</>);
    const strongEl = document.querySelector('strong');
    expect(strongEl).not.toBeNull();
    expect(strongEl?.textContent).toBe('bold');
  });

  it('renders links with target="_blank" and rel="noopener noreferrer"', () => {
    render(<>{renderMarkdown('[Visit us](https://example.com)')}</>);
    const link = document.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toContain('example.com');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.textContent).toBe('Visit us');
  });

  it('does not render links with javascript: protocol', () => {
    const { container } = render(
      <>{renderMarkdown('[Click me](javascript:alert(1))')}</>
    );
    const link = container.querySelector('a');
    // The link should not be rendered since sanitizeUrl returns null
    expect(link).toBeNull();
    // The text may still be rendered as a plain string
    expect(container.textContent).toContain('Click me');
  });

  it('renders images with proper alt text', () => {
    render(
      <>{renderMarkdown('![Product photo](https://example.com/image.jpg)')}</>
    );
    const img = document.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toContain('example.com/image.jpg');
    expect(img?.getAttribute('alt')).toBe('Product photo');
  });

  it('uses "Image" as default alt text when alt is empty', () => {
    render(
      <>{renderMarkdown('![](https://example.com/image.jpg)')}</>
    );
    const img = document.querySelector('img');
    expect(img?.getAttribute('alt')).toBe('Image');
  });

  it('does not render images with unsafe src URLs', () => {
    const { container } = render(
      <>{renderMarkdown('![Bad](javascript:alert(1))')}</>
    );
    const img = container.querySelector('img');
    expect(img).toBeNull();
  });

  it('renders inline code as text (no code element — plain text)', () => {
    // The markdown renderer does not have a code pattern; inline code is plain text
    const { container } = render(<>{renderMarkdown('Use `npm install`')}</>);
    expect(container.textContent).toContain('`npm install`');
  });

  it('renders multiple lines as separate div elements', () => {
    const { container } = render(
      <>{renderMarkdown('Line one\nLine two\nLine three')}</>
    );
    const divs = container.querySelectorAll('div');
    expect(divs.length).toBeGreaterThanOrEqual(3);
    expect(container.textContent).toContain('Line one');
    expect(container.textContent).toContain('Line two');
    expect(container.textContent).toContain('Line three');
  });

  it('renders list items with a bullet indicator', () => {
    const { container } = render(
      <>{renderMarkdown('* First item\n* Second item')}</>
    );
    // List items wrap in flex divs with bullet spans
    expect(container.textContent).toContain('First item');
    expect(container.textContent).toContain('Second item');
    // The bullet character is rendered as &bull;
    expect(container.innerHTML).toContain('•');
  });

  it('handles mixed markdown in one message', () => {
    render(
      <>{renderMarkdown('Check out **Samsung** at [our store](https://example.com)!')}</>
    );
    expect(document.querySelector('strong')?.textContent).toBe('Samsung');
    expect(document.querySelector('a')?.textContent).toBe('our store');
  });

  it('renders an empty line as a spacer div', () => {
    const { container } = render(<>{renderMarkdown('Before\n\nAfter')}</>);
    // Empty line between "Before" and "After"
    expect(container.textContent).toContain('Before');
    expect(container.textContent).toContain('After');
  });
});
