import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NewBlogPostSeoTab } from './new-blog-post-seo-tab';
import type { NewBlogPostFormData } from './new-blog-post-types';

const formData: NewBlogPostFormData = {
  author_bio: '',
  author_name: '',
  author_title: '',
  category: '',
  content: '',
  excerpt: 'A short description',
  featured_image_alt: '',
  featured_image_height: null,
  featured_image_url: '',
  featured_image_variants: {},
  featured_image_width: null,
  seo_description: '',
  seo_title: '',
  slug: 'summer-sale',
  tags: '',
  title: 'Summer sale',
};

describe('NewBlogPostSeoTab', () => {
  it('uses the custom domain in the search preview', () => {
    render(
      <NewBlogPostSeoTab
        formData={formData}
        handleChange={vi.fn()}
        merchant={{ custom_domain: 'https://shop.example.com/' }}
      />
    );

    expect(
      screen.getByText('https://shop.example.com/blog/summer-sale')
    ).toBeInTheDocument();
    expect(screen.getByText('Summer sale')).toBeInTheDocument();
  });

  it('updates the explicit SEO title when the field is edited', () => {
    const handleChange = vi.fn();
    render(
      <NewBlogPostSeoTab
        formData={formData}
        handleChange={handleChange}
        merchant={{ slug: 'baci' }}
      />
    );

    fireEvent.change(screen.getByLabelText(/^seo title$/i), {
      target: { value: ' | Baci' },
    });

    expect(handleChange).toHaveBeenLastCalledWith('seo_title', ' | Baci');
  });
});
