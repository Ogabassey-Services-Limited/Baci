import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { EditBlogContentTab } from './edit-blog-content-tab';
import { INITIAL_FORM_DATA } from './edit-blog-form-data';
import type { Product } from './edit-blog-types';

vi.mock('@/components/blog/blog-editor', () => ({
  BlogEditor: ({ onChange }: { onChange: (value: string) => void }) => (
    <button type="button" onClick={() => onChange('Updated editor content')}>
      Update editor content
    </button>
  ),
}));

vi.mock('@/components/blog/product-embed-grid', () => ({
  ProductGrid: ({ products }: { products: Product[] }) => (
    <div>Products: {products.map((product) => product.name).join(', ')}</div>
  ),
}));

vi.mock('@/components/ui/file-uploader', () => ({
  FileUploader: ({
    onFilesSelected,
  }: {
    onFilesSelected: (files: File[]) => Promise<void>;
  }) => (
    <button
      type="button"
      onClick={() =>
        void onFilesSelected([
          new File(['image'], 'featured.png', { type: 'image/png' }),
        ])
      }
    >
      Upload featured image
    </button>
  ),
}));

const embeddedProduct: Product = {
  id: 'product-1',
  images: [],
  name: 'Camera',
  price: 20000,
  slug: 'camera',
  status: 'active',
};

describe('EditBlogContentTab', () => {
  it('normalizes an edited slug before reporting it to the form', async () => {
    const handleChange = vi.fn();
    render(<EditBlogContentTab {...props({ handleChange })} />);

    fireEvent.change(screen.getByLabelText('URL Slug'), {
      target: { value: 'New Post! 2026' },
    });

    expect(handleChange).toHaveBeenLastCalledWith('slug', 'newpost2026');
  });

  it('clears every embedded product only after the editor exposes them', async () => {
    const setEmbeddedProducts = vi.fn();
    const user = userEvent.setup();

    render(
      <EditBlogContentTab
        {...props({ setEmbeddedProducts })}
        embeddedProducts={[embeddedProduct]}
      />
    );

    expect(screen.getByText('Products: Camera')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: /clear all products/i })
    );

    expect(setEmbeddedProducts).toHaveBeenCalledWith([]);
  });

  it('forwards featured image selections to the upload action', async () => {
    const onFeaturedImageUpload = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<EditBlogContentTab {...props({ onFeaturedImageUpload })} />);
    await user.click(
      screen.getByRole('button', { name: /upload featured image/i })
    );

    expect(onFeaturedImageUpload).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'featured.png' }),
    ]);
  });
});

function props(
  overrides: Partial<ComponentProps<typeof EditBlogContentTab>> = {}
): ComponentProps<typeof EditBlogContentTab> {
  return {
    contentResetKey: 0,
    embeddedProducts: [],
    formData: INITIAL_FORM_DATA,
    handleChange: vi.fn(),
    isUploading: false,
    merchantId: 'merchant-1',
    merchantSlug: 'baci',
    onFeaturedImageUpload: vi.fn().mockResolvedValue(undefined),
    onImageUpload: vi
      .fn()
      .mockResolvedValue('https://cdn.example.com/image.png'),
    onRemoveFeaturedImage: vi.fn().mockResolvedValue(undefined),
    setEmbeddedProducts: vi.fn(),
    ...overrides,
  };
}
