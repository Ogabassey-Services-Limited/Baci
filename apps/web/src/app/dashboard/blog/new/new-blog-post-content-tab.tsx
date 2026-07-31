import { Loader2, X } from 'lucide-react';
import Image from 'next/image';
import { BlogEditor } from '@/components/blog/blog-editor';
import { ProductGrid } from '@/components/blog/product-embed-grid';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FileUploader } from '@/components/ui/file-uploader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getFeaturedImagePreviewUrl } from './new-blog-post-form-data';
import type {
  NewBlogPostFormData,
  NewBlogProduct,
} from './new-blog-post-types';

export function NewBlogPostContentTab({
  formData,
  contentResetKey,
  merchantId,
  merchantSlug,
  embeddedProducts,
  setEmbeddedProducts,
  handleTitleChange,
  handleChange,
  onImageUpload,
  onFeaturedImageUpload,
  onRemoveFeaturedImage,
  isUploading,
}: {
  formData: NewBlogPostFormData;
  contentResetKey: number;
  merchantId?: string;
  merchantSlug?: string;
  embeddedProducts: NewBlogProduct[];
  setEmbeddedProducts: (products: NewBlogProduct[]) => void;
  handleTitleChange: (title: string) => void;
  handleChange: (field: keyof NewBlogPostFormData, value: string) => void;
  onImageUpload: (file: File) => Promise<string>;
  onFeaturedImageUpload: (files: File[]) => Promise<void>;
  onRemoveFeaturedImage: () => Promise<void>;
  isUploading: boolean;
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Post Content</CardTitle>
          <CardDescription>
            Just paste text and images - formatting is handled automatically
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Enter post title"
              value={formData.title}
              onChange={(event) => handleTitleChange(event.target.value)}
              className="text-lg font-medium"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">URL Slug</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                /{merchantSlug}/blog/
              </span>
              <Input
                id="slug"
                placeholder="auto-generated-from-title"
                value={formData.slug}
                onChange={(event) =>
                  handleChange(
                    'slug',
                    event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                  )
                }
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Content *</Label>
            <BlogEditor
              merchantId={merchantId}
              content={formData.content}
              contentResetKey={contentResetKey}
              onChange={(content) => handleChange('content', content)}
              onImageUpload={onImageUpload}
              onProductsChange={setEmbeddedProducts}
              embeddedProducts={embeddedProducts}
              placeholder="Start writing... Drag and drop images, or click the shopping bag icon to embed products."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="excerpt">Excerpt (optional)</Label>
            <Textarea
              id="excerpt"
              placeholder="Auto-generated from content if left empty"
              value={formData.excerpt}
              onChange={(event) => handleChange('excerpt', event.target.value)}
              rows={3}
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground">
              {formData.excerpt.length}/300 characters
            </p>
          </div>
        </CardContent>
      </Card>
      {embeddedProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Embedded Products ({embeddedProducts.length})</CardTitle>
            <CardDescription>
              These products will appear in your blog post
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProductGrid
              products={embeddedProducts}
              merchantSlug={merchantSlug}
            />
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setEmbeddedProducts([])}
            >
              <X className="size-4 mr-2" />
              Clear All Products
            </Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Featured Image</CardTitle>
          <CardDescription>
            Recommended: min 1200px wide for Google Discover
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <Label>Featured Image</Label>
            {formData.featured_image_url ? (
              <div className="relative aspect-video max-w-md rounded-lg overflow-hidden border bg-muted">
                <Image
                  src={getFeaturedImagePreviewUrl(formData)}
                  alt="Featured image preview"
                  fill
                  sizes="(max-width: 768px) 100vw, 448px"
                  className="object-cover"
                  unoptimized
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={onRemoveFeaturedImage}
                  >
                    <X className="size-4 mr-2" />
                    Remove Image
                  </Button>
                </div>
              </div>
            ) : (
              <FileUploader
                onFilesSelected={onFeaturedImageUpload}
                maxFiles={1}
                maxSize={5 * 1024 * 1024}
                accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] }}
                className="max-w-md"
              />
            )}
            {isUploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Uploading image…
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="featured_image_alt">Alt Text</Label>
            <Input
              id="featured_image_alt"
              placeholder="Describe the image (for accessibility)"
              value={formData.featured_image_alt}
              onChange={(event) =>
                handleChange('featured_image_alt', event.target.value)
              }
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Organization (optional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              placeholder="Product News, Tutorials"
              value={formData.category}
              onChange={(event) => handleChange('category', event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              placeholder="Separate with commas"
              value={formData.tags}
              onChange={(event) => handleChange('tags', event.target.value)}
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
