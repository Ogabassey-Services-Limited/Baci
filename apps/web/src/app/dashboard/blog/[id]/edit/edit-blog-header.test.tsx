import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { INITIAL_FORM_DATA } from './edit-blog-form-data';
import { EditBlogHeader } from './edit-blog-header';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('EditBlogHeader', () => {
  it('publishes a draft through the explicit published save status', async () => {
    const savePost = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();

    render(<EditBlogHeader {...props({ savePost })} />);
    await user.click(screen.getByRole('button', { name: /publish now/i }));

    expect(savePost).toHaveBeenCalledWith('published');
  });

  it('uses the validated merchant custom domain for the live post link', () => {
    render(
      <EditBlogHeader
        {...props({
          formData: {
            ...INITIAL_FORM_DATA,
            slug: 'launch',
            status: 'published',
          },
          merchant: { custom_domain: 'store.example.com/', slug: 'store' },
        })}
      />
    );

    expect(screen.getByRole('link', { name: /view live/i })).toHaveAttribute(
      'href',
      'https://store.example.com/blog/launch'
    );
  });

  it('does not expose a live link for an unsafe merchant slug', () => {
    render(
      <EditBlogHeader
        {...props({
          formData: { ...INITIAL_FORM_DATA, status: 'published' },
          merchant: { slug: '../other-merchant' },
        })}
      />
    );

    expect(
      screen.queryByRole('link', { name: /view live/i })
    ).not.toBeInTheDocument();
  });
});

function props(
  overrides: Partial<ComponentProps<typeof EditBlogHeader>> = {}
): ComponentProps<typeof EditBlogHeader> {
  return {
    formData: INITIAL_FORM_DATA,
    isSaving: false,
    merchant: { slug: 'baci' },
    onPreview: vi.fn().mockResolvedValue(undefined),
    onSuggestSchedule: vi.fn(),
    originalPost: null,
    readingTime: 1,
    savePost: vi.fn().mockResolvedValue(true),
    scheduledDate: undefined,
    setScheduledDate: vi.fn(),
    wordCount: 10,
    ...overrides,
  };
}
