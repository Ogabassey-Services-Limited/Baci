import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/dynamic', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  return {
    default: () =>
      function TiptapInitialContentBoundary({
        initialValue,
      }: {
        initialValue?: string;
      }) {
        const [mountedContent] = React.useState(initialValue);
        return <output data-testid="tiptap-content">{mountedContent}</output>;
      },
  };
});

import { BlogEditor } from './blog-editor';

describe('BlogEditor', () => {
  it('exports a valid component', () => {
    expect(BlogEditor).toBeDefined();
    expect(typeof BlogEditor).toBe('function');
  });

  it('remounts the Tiptap boundary when recovered draft content resets', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <BlogEditor
        merchantId="merchant-1"
        content="stale editor content"
        contentResetKey={0}
        onChange={onChange}
      />
    );

    expect(screen.getByTestId('tiptap-content')).toHaveTextContent(
      'stale editor content'
    );

    rerender(
      <BlogEditor
        merchantId="merchant-1"
        content="recovered draft content"
        contentResetKey={0}
        onChange={onChange}
      />
    );
    expect(screen.getByTestId('tiptap-content')).toHaveTextContent(
      'stale editor content'
    );

    rerender(
      <BlogEditor
        merchantId="merchant-1"
        content="recovered draft content"
        contentResetKey={1}
        onChange={onChange}
      />
    );
    expect(screen.getByTestId('tiptap-content')).toHaveTextContent(
      'recovered draft content'
    );
  });
});
