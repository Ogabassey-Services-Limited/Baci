import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SafeHtml } from './safe-html';
import { sanitizeForSafeHtml } from './sanitized-html';

describe('SafeHtml', () => {
  it('renders sanitized HTML content', () => {
    render(<SafeHtml html="<p>Hello <strong>world</strong></p>" />);
    expect(screen.getByText('world')).toBeInTheDocument();
  });

  it('renders a branded sanitized string without applying options again', () => {
    const sanitizedHtml = sanitizeForSafeHtml('<h1>Already normalized</h1>', {
      headingLevelOffset: 1,
    });

    render(<SafeHtml sanitizedHtml={sanitizedHtml} headingLevelOffset={1} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Already normalized' })
    ).toBeInTheDocument();
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

  it('forwards nofollow stripping to the sanitizer without leaking the option to the DOM', () => {
    const { container } = render(
      <SafeHtml
        html='<a href="https://example.com" rel="nofollow">Source</a>'
        stripNofollowFromLinks
      />
    );

    const link = screen.getByRole('link', { name: 'Source' });
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(container.firstElementChild).not.toHaveAttribute(
      'stripNofollowFromLinks'
    );
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

  it('strips user-supplied fetch priority markers by default', () => {
    const imageSource =
      'https://cdn.ogabassey.com/core-assets/blog/merchant/inline-1.png';
    const { container } = render(
      <SafeHtml
        html={`<img src="${imageSource}" alt="Body image" data-baci-priority-image="true" fetchpriority="high">`}
      />
    );

    const image = screen.getByRole('img', { name: 'Body image' });
    expect(image).not.toHaveAttribute('fetchpriority');
    expect(container.innerHTML).not.toContain('data-baci-priority-image');
  });

  it('preserves fetch priority only for trusted internally generated image sources', () => {
    const imageSource =
      'https://cdn.ogabassey.com/core-assets/blog/merchant/inline-1.png';
    const { container } = render(
      <SafeHtml
        html={`<img src="${imageSource}" alt="Priority image" data-baci-priority-image="true" fetchpriority="high">`}
        trustedPriorityImageSources={[imageSource]}
      />
    );

    const image = screen.getByRole('img', { name: 'Priority image' });
    expect(image).toHaveAttribute('fetchpriority', 'high');
    expect(container.innerHTML).not.toContain('data-baci-priority-image');
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

  it('normalizes SEO-hostile anchors when requested without stripping legitimate resource links', () => {
    render(
      <SafeHtml
        html='<a href="https://example.com/data.json">Raw JSON</a><a href="https://example.com/phone"></a>'
        normalizeSeoAnchors={true}
      />
    );

    expect(screen.getByRole('link', { name: 'Raw JSON' })).toHaveAttribute(
      'rel',
      'noopener noreferrer'
    );
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});
