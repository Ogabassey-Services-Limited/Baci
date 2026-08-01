import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NewBlogPostContentTab } from './new-blog-post-content-tab';
import type { NewBlogPostFormData } from './new-blog-post-types';

vi.mock('@/components/blog/blog-editor', () => ({
  BlogEditor: () => <div>Editor</div>,
}));

const formData: NewBlogPostFormData = {
  author_bio: '',
  author_name: 'Baci',
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

describe('NewBlogPostContentTab', () => {
  it('removes non-slug characters before updating the form', async () => {
    const handleChange = vi.fn();
    render(
      <NewBlogPostContentTab
        contentResetKey={0}
        embeddedProducts={[]}
        formData={formData}
        handleChange={handleChange}
        handleTitleChange={vi.fn()}
        isUploading={false}
        merchantSlug="baci"
        onFeaturedImageUpload={vi.fn()}
        onImageUpload={vi.fn()}
        onRemoveFeaturedImage={vi.fn()}
        setEmbeddedProducts={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/url slug/i), {
      target: { value: 'Hello World!' },
    });

    expect(handleChange).toHaveBeenLastCalledWith('slug', 'helloworld');
  });

  it('clears all selected embedded products', async () => {
    const user = userEvent.setup();
    const setEmbeddedProducts = vi.fn();
    render(
      <NewBlogPostContentTab
        contentResetKey={0}
        embeddedProducts={[
          {
            id: '1',
            images: [],
            name: 'Bag',
            price: 1000,
            slug: 'bag',
            status: 'published',
          },
        ]}
        formData={formData}
        handleChange={vi.fn()}
        handleTitleChange={vi.fn()}
        isUploading={false}
        onFeaturedImageUpload={vi.fn()}
        onImageUpload={vi.fn()}
        onRemoveFeaturedImage={vi.fn()}
        setEmbeddedProducts={setEmbeddedProducts}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /clear all products/i })
    );

    expect(setEmbeddedProducts).toHaveBeenCalledWith([]);
  });
});
