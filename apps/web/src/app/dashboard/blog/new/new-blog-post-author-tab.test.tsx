import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NewBlogPostAuthorTab } from './new-blog-post-author-tab';
import type { NewBlogPostFormData } from './new-blog-post-types';

const formData: NewBlogPostFormData = {
  author_bio: '',
  author_name: '',
  author_title: '',
  category: '',
  content: '',
  excerpt: '',
  featured_image_alt: '',
  featured_image_height: null,
  featured_image_url: '',
  featured_image_variants: {},
  featured_image_width: null,
  seo_description: '',
  seo_title: '',
  slug: '',
  tags: '',
  title: '',
};

describe('NewBlogPostAuthorTab', () => {
  it('reports author-field edits using their form keys', () => {
    const handleChange = vi.fn();
    render(
      <NewBlogPostAuthorTab formData={formData} handleChange={handleChange} />
    );

    fireEvent.change(screen.getByLabelText(/author name/i), {
      target: { value: 'Ada Lovelace' },
    });
    fireEvent.change(screen.getByLabelText(/author bio/i), {
      target: { value: 'Engineer' },
    });

    expect(handleChange).toHaveBeenCalledWith('author_name', 'Ada Lovelace');
    expect(handleChange).toHaveBeenLastCalledWith('author_bio', 'Engineer');
  });
});
