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

  it('strips inline style attributes', () => {
    render(
      <SafeHtml html='<p style="background:url(javascript:alert(1))">Styled</p>' />
    );
    expect(screen.getByText('Styled')).not.toHaveAttribute('style');
  });

  it('renders sanitized HTML inside the requested code wrapper', () => {
    const { container } = render(
      <SafeHtml
        as="code"
        className="language-js"
        html='<span class="hljs-keyword" style="color:red">const</span>'
      />
    );

    const code = container.querySelector('code');
    expect(code).toBeInTheDocument();
    expect(code).toHaveClass('language-js');
    const span = code?.querySelector('span');
    expect(span).toHaveClass('hljs-keyword');
    expect(span).toHaveTextContent('const');
    expect(span).not.toHaveAttribute('style');
  });

  it('renders sanitized HTML inside the requested span wrapper', () => {
    const { container } = render(
      <SafeHtml as="span" html='<code class="language-ts">type X = 1</code>' />
    );

    const wrapper = container.querySelector('span');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper?.querySelector('code')).toHaveClass('language-ts');
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
      <SafeHtml html='<a href="https://example.com" target="_blank" rel="noopener noreferrer">Link</a>' />
    );
    const link = screen.getByRole('link', { name: 'Link' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('handles empty string', () => {
    const { container } = render(<SafeHtml html="" />);
    expect(container.firstChild).toBeEmptyDOMElement();
  });

  it('strips javascript: protocol URLs from links', () => {
    render(<SafeHtml html='<a href="javascript:alert(1)">Malicious</a>' />);
    // sanitize-html removes href with disallowed schemes, so the <a> is no longer a link
    expect(screen.queryByRole('link', { name: 'Malicious' })).toBeNull();
    // The text content is still rendered
    expect(screen.getByText('Malicious')).toBeInTheDocument();
  });

  it('demotes heading tags when headingLevelOffset is provided', () => {
    const { container } = render(
      <SafeHtml
        html="<h1>Imported Title</h1><h2>Imported Section</h2>"
        headingLevelOffset={1}
      />
    );

    expect(container.querySelector('h1')).toBeNull();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Imported Title' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Imported Section' })
    ).toBeInTheDocument();
  });
});
