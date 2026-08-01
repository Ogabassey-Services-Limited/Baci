import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NewBlogPostHeader } from './new-blog-post-header';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/lib/routes', () => ({ asRoute: (route: string) => route }));

describe('NewBlogPostHeader', () => {
  it('runs the selected publish action and shows the derived reading stats', async () => {
    const user = userEvent.setup();
    const onPublish = vi.fn();
    render(
      <NewBlogPostHeader
        isSaving={false}
        onPreview={vi.fn()}
        onPublish={onPublish}
        onSaveDraft={vi.fn()}
        readingTime={3}
        wordCount={521}
      />
    );

    await user.click(screen.getByRole('button', { name: /publish/i }));

    expect(screen.getByText('521 words | 3 min read')).toBeInTheDocument();
    expect(onPublish).toHaveBeenCalledOnce();
  });

  it('prevents duplicate actions while a save is in progress', () => {
    render(
      <NewBlogPostHeader
        isSaving={true}
        onPreview={vi.fn()}
        onPublish={vi.fn()}
        onSaveDraft={vi.fn()}
        readingTime={1}
        wordCount={10}
      />
    );

    expect(screen.getByRole('button', { name: /preview/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /save draft/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /publish/i })).toBeDisabled();
  });
});
