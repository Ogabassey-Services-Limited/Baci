import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SafeHtml } from './safe-html';

describe('SafeHtml', () => {
  it('renders sanitized HTML content', () => {
    render(<SafeHtml html="<p>Hello <strong>world</strong></p>" />);
    expect(screen.getByText('world')).toBeInTheDocument();
  });

  it('strips script tags', () => {
    const { container } = render(
      <SafeHtml html='<p>Safe</p><script>alert("xss")</script>' />
    );
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('Safe')).toBeInTheDocument();
  });

  it('strips event handlers', () => {
    render(<SafeHtml html='<div onclick="alert(1)">Click</div>' />);
    const div = screen.getByText('Click');
    expect(div.getAttribute('onclick')).toBeNull();
  });

  it('strips iframe tags', () => {
    const { container } = render(
      <SafeHtml html='<p>Content</p><iframe src="https://evil.example.com"></iframe>' />
    );
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('passes className to the wrapper div', () => {
    const { container } = render(
      <SafeHtml html="<p>Styled</p>" className="prose max-w-none" />
    );
    expect(container.firstChild).toHaveClass('prose', 'max-w-none');
  });

  it('renders without className when not provided', () => {
    const { container } = render(<SafeHtml html="<p>Plain</p>" />);
    expect(container.firstChild).not.toHaveAttribute('class');
  });

  it('preserves allowed tags and attributes', () => {
    render(
      <SafeHtml html='<a href="https://example.com" target="_blank">Link</a>' />
    );
    const link = screen.getByRole('link', { name: 'Link' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('handles empty string', () => {
    const { container } = render(<SafeHtml html="" />);
    expect(container.firstChild).toBeEmptyDOMElement();
  });
});
