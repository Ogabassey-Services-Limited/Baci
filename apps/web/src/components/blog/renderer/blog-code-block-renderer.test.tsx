import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlogCodeBlockRenderer } from './blog-code-block-renderer';

describe('BlogCodeBlockRenderer', () => {
  it('renders highlighted code for a registered language', () => {
    const node = {
      type: 'codeBlock',
      attrs: { language: 'javascript' },
      content: [{ type: 'text', text: 'const x = 1;' }],
    };

    const { container } = render(
      <BlogCodeBlockRenderer node={node}>const x = 1;</BlogCodeBlockRenderer>
    );

    const code = container.querySelector('code.language-javascript');
    expect(code).not.toBeNull();
    expect(code?.textContent).toContain('const');
  });

  it('falls back to auto-highlighting when no language is given', () => {
    const node = {
      type: 'codeBlock',
      content: [{ type: 'text', text: 'plain snippet' }],
    };

    render(
      <BlogCodeBlockRenderer node={node}>plain snippet</BlogCodeBlockRenderer>
    );

    expect(screen.getByText(/plain snippet/)).toBeInTheDocument();
  });
});
