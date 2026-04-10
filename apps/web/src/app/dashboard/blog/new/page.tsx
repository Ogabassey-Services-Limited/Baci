'use client';

import { ArrowLeft, Eye, Loader2, Save, Send, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BlogEditor } from '@/components/blog/blog-editor';
import { ProductGrid } from '@/components/blog/product-embed';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useBlogAutoSave } from '@/hooks/use-blog-auto-save';
import { useMerchant } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import { fetchWithCsrf } from '@/lib/api-client';
import { asRoute } from '@/lib/routes';
import { getPreviewUrl } from '../actions';

interface Product {
  id: string;
  name: string;
  price: number;
  compare_at_price?: number;
  images: string[];
  slug: string;
  status: string;
}

interface PostFormData {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  featured_image_url: string;
  featured_image_alt: string;
  category: string;
  tags: string;
  author_name: string;
  author_title: string;
  author_bio: string;
  seo_title: string;
  seo_description: string;
}

export default function NewBlogPostPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { merchant } = useMerchant();

  const [formData, setFormData] = useState<PostFormData>({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    featured_image_url: '',
    featured_image_alt: '',
    category: '',
    tags: '',
    author_name: merchant?.business_name || '',
    author_title: '',
    author_bio: '',
    seo_title: '',
    seo_description: '',
  });

  // Update author name when merchant loads
  useEffect(() => {
    if (merchant?.business_name) {
      setFormData((prev) => {
        if (!prev.author_name) {
          return { ...prev, author_name: merchant.business_name };
        }
        return prev;
      });
    }
  }, [merchant?.business_name]);
  const [embeddedProducts, setEmbeddedProducts] = useState<Product[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('content');
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [hasAutoRecovered, setHasAutoRecovered] = useState(false); // Track if we've already auto-recovered

  // Auto-save to localStorage (protects against Chrome Memory Saver)
  const { clearSavedData, hasSavedData, getSavedData } = useBlogAutoSave({
    storageKey: 'blog-draft-new',
    data: formData,
  });

  // Silent auto-recovery on mount (no blocking dialog)
  useEffect(() => {
    if (!hasAutoRecovered && hasSavedData()) {
      const saved = getSavedData();
      if (saved) {
        setFormData(saved.data);
        setHasAutoRecovered(true);
        toast({
          title: 'Draft Recovered',
          description: 'Your previous work has been restored.',
          action: (
            <button
              type="button"
              onClick={() => {
                setFormData({
                  title: '',
                  slug: '',
                  content: '',
                  excerpt: '',
                  featured_image_url: '',
                  featured_image_alt: '',
                  category: '',
                  tags: '',
                  author_name: merchant?.business_name || '',
                  author_title: '',
                  author_bio: '',
                  seo_title: '',
                  seo_description: '',
                });
                clearSavedData();
                toast({
                  title: 'Recovery Undone',
                  description: 'Started with a fresh post.',
                });
              }}
              className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
            >
              Undo
            </button>
          ),
          duration: 8000,
        });
      }
    }
  }, [
    hasAutoRecovered,
    hasSavedData,
    getSavedData,
    toast,
    merchant?.business_name,
    clearSavedData,
  ]); // Only run once on mount

  const recoverDraft = () => {
    const saved = getSavedData();
    if (saved) {
      setFormData(saved.data);
      toast({
        title: 'Draft Recovered',
        description: 'Your previous work has been restored.',
      });
    }
    setShowRecoveryDialog(false);
  };

  const discardRecoveredDraft = () => {
    clearSavedData();
    setShowRecoveryDialog(false);
  };

  // Auto-generate slug from title
  const handleTitleChange = (title: string) => {
    setFormData((prev) => ({
      ...prev,
      title,
      slug: title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 200),
    }));
  };

  const handleChange = (field: keyof PostFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const [isUploading, setIsUploading] = useState(false);

  // Handle featured image selection and upload
  const handleFeaturedImageUpload = async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);
    const file = files[0];
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const response = await fetchWithCsrf('/api/merchant/blog/upload', {
        method: 'POST',
        body: formDataUpload,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload image');
      }

      const data = await response.json();
      handleChange('featured_image_url', data.url);
      toast({
        title: 'Success',
        description: 'Featured image uploaded successfully.',
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Image upload handler for the editor
  const handleImageUpload = async (file: File): Promise<string> => {
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    const response = await fetchWithCsrf('/api/merchant/blog/upload', {
      method: 'POST',
      body: formDataUpload,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload image');
    }

    const data = await response.json();
    return data.url;
  };

  const validateForm = (): string | null => {
    if (!formData.title.trim()) return 'Title is required';
    if (!formData.content.trim()) return 'Content is required';
    if (!formData.author_name.trim()) return 'Author name is required';
    if (formData.slug && !/^[a-z0-9-]+$/.test(formData.slug)) {
      return 'Slug can only contain lowercase letters, numbers, and hyphens';
    }
    return null;
  };

  const savePost = async (
    status: 'draft' | 'published',
    shouldRedirect = true
  ) => {
    const error = validateForm();
    if (error) {
      toast({
        title: 'Validation Error',
        description: error,
        variant: 'destructive',
      });
      return null;
    }

    setIsSaving(true);
    try {
      const postData = {
        title: formData.title.trim(),
        slug: formData.slug || undefined,
        content: formData.content,
        excerpt: formData.excerpt || undefined,
        featured_image_url: formData.featured_image_url || null,
        featured_image_alt: formData.featured_image_alt || undefined,
        category: formData.category || undefined,
        tags: formData.tags
          ? formData.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        author_name: formData.author_name,
        author_title: formData.author_title || undefined,
        author_bio: formData.author_bio || undefined,
        seo_title: formData.seo_title || undefined,
        seo_description: formData.seo_description || undefined,
        embedded_products: embeddedProducts.map((p) => p.id),
        status,
      };

      const response = await fetchWithCsrf('/api/merchant/blog/posts', {
        method: 'POST',
        body: JSON.stringify(postData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create post');
      }

      const savedPost = await response.json();

      toast({
        title: status === 'published' ? 'Post Published!' : 'Draft Saved',
        description:
          status === 'published'
            ? 'Your blog post is now live.'
            : 'Your draft has been saved.',
      });

      // Clear auto-saved draft on successful server save
      clearSavedData();

      if (shouldRedirect) {
        router.push(asRoute('/dashboard/blog'));
      }

      return savedPost;
    } catch (error) {
      console.error('Error saving post:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save blog post.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!merchant?.slug) {
      toast({
        title: 'Error',
        description: 'Merchant slug not found.',
        variant: 'destructive',
      });
      return;
    }

    // Save as draft first
    const savedPost = await savePost('draft', false);
    if (!savedPost) return;

    try {
      const previewUrl = await getPreviewUrl(merchant.slug, savedPost.slug);
      window.open(previewUrl, '_blank');

      // Redirect to edit page
      router.push(asRoute(`/dashboard/blog/${savedPost.id}/edit`));
    } catch (error) {
      console.error('Error getting preview URL:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate preview link.',
        variant: 'destructive',
      });
    }
  };

  // Calculate word count from JSON content
  const getTextContent = (jsonString: string) => {
    try {
      if (!jsonString) return '';
      // If it looks like HTML (starts with <), use DOMParser
      if (jsonString.trim().startsWith('<') && typeof window !== 'undefined') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(jsonString, 'text/html');
        return doc.body.textContent || '';
      }

      const json = JSON.parse(jsonString);
      let text = '';
      // biome-ignore lint/suspicious/noExplicitAny: Tiptap JSON content
      const traverse = (node: any) => {
        if (node.text) text += `${node.text} `;
        if (node.content && Array.isArray(node.content)) {
          node.content.forEach(traverse);
        }
      };
      traverse(json);
      return text.trim();
    } catch {
      return '';
    }
  };
  const wordCount = getTextContent(formData.content)
    .split(/\s+/)
    .filter(Boolean).length;
  const readingTime = Math.ceil(wordCount / 200);

  // SEO metrics
  const titleLength = formData.seo_title?.length || formData.title.length;
  const descriptionLength =
    formData.seo_description?.length || formData.excerpt.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={asRoute('/dashboard/blog')}>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">New Blog Post</h1>
            <p className="text-sm text-muted-foreground">
              {wordCount} words | {readingTime} min read
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePreview} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Eye className="w-4 h-4 mr-2" />
            )}
            Preview
          </Button>
          <Button
            variant="outline"
            onClick={() => savePost('draft')}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Draft
          </Button>
          <Button onClick={() => savePost('published')} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Publish
          </Button>
        </div>
      </div>

      {/* Editor Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="author">Author</TabsTrigger>
        </TabsList>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-6">
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
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="text-lg font-medium"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    /{merchant?.slug}/blog/
                  </span>
                  <Input
                    id="slug"
                    placeholder="auto-generated-from-title"
                    value={formData.slug}
                    onChange={(e) =>
                      handleChange(
                        'slug',
                        e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                      )
                    }
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Content *</Label>
                <BlogEditor
                  content={formData.content}
                  onChange={(content) => handleChange('content', content)}
                  onImageUpload={handleImageUpload}
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
                  onChange={(e) => handleChange('excerpt', e.target.value)}
                  rows={3}
                  maxLength={300}
                />
                <p className="text-xs text-muted-foreground">
                  {formData.excerpt.length}/300 characters
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Embedded Products Preview */}
          {embeddedProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Embedded Products ({embeddedProducts.length})
                </CardTitle>
                <CardDescription>
                  These products will appear in your blog post
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProductGrid
                  products={embeddedProducts}
                  merchantSlug={merchant?.slug}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setEmbeddedProducts([])}
                >
                  <X className="w-4 h-4 mr-2" />
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
                      src={formData.featured_image_url}
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
                        onClick={() => handleChange('featured_image_url', '')}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Remove Image
                      </Button>
                    </div>
                  </div>
                ) : (
                  <FileUploader
                    onFilesSelected={handleFeaturedImageUpload}
                    maxFiles={1}
                    maxSize={5 * 1024 * 1024}
                    accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] }}
                    className="max-w-md"
                  />
                )}
                {isUploading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading image...
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="featured_image_alt">Alt Text</Label>
                <Input
                  id="featured_image_alt"
                  placeholder="Describe the image (for accessibility)"
                  value={formData.featured_image_alt}
                  onChange={(e) =>
                    handleChange('featured_image_alt', e.target.value)
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
                  onChange={(e) => handleChange('category', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  placeholder="Separate with commas"
                  value={formData.tags}
                  onChange={(e) => handleChange('tags', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEO Tab */}
        <TabsContent value="seo" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>SEO Settings</CardTitle>
              <CardDescription>
                Optional - we auto-generate these if left empty
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="seo_title">SEO Title</Label>
                <Input
                  id="seo_title"
                  placeholder={formData.title || 'Uses post title if empty'}
                  value={formData.seo_title}
                  onChange={(e) => handleChange('seo_title', e.target.value)}
                  maxLength={70}
                />
                <div className="flex justify-between text-xs">
                  <span
                    className={
                      titleLength > 60
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    }
                  >
                    {titleLength}/60 characters
                  </span>
                  {titleLength >= 50 && titleLength <= 60 && (
                    <span className="text-green-600">Good!</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo_description">Meta Description</Label>
                <Textarea
                  id="seo_description"
                  placeholder={
                    formData.excerpt || 'Auto-generated from content'
                  }
                  value={formData.seo_description}
                  onChange={(e) =>
                    handleChange('seo_description', e.target.value)
                  }
                  rows={3}
                  maxLength={160}
                />
                <div className="flex justify-between text-xs">
                  <span
                    className={
                      descriptionLength > 160
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    }
                  >
                    {descriptionLength}/160 characters
                  </span>
                  {descriptionLength >= 120 && descriptionLength <= 160 && (
                    <span className="text-green-600">Good!</span>
                  )}
                </div>
              </div>

              {/* SEO Preview */}
              <div className="pt-4 border-t">
                <Label className="mb-2 block">Search Preview</Label>
                <div className="p-4 bg-white dark:bg-slate-950 rounded-lg border">
                  <div className="text-blue-600 dark:text-blue-400 text-lg hover:underline cursor-pointer truncate">
                    {formData.seo_title || formData.title || 'Post Title'}
                  </div>
                  <div className="text-green-700 dark:text-green-500 text-sm">
                    {merchant?.custom_domain
                      ? `${merchant.custom_domain.replace(/\/$/, '')}/blog/`
                      : `/${merchant?.slug}/blog/`}
                    {formData.slug || 'post-slug'}
                  </div>
                  <div className="text-sm text-muted-foreground line-clamp-2">
                    {formData.seo_description ||
                      formData.excerpt ||
                      'Description auto-generated from content...'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Author Tab */}
        <TabsContent value="author" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Author Information</CardTitle>
              <CardDescription>For credibility (E-E-A-T)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="author_name">Author Name *</Label>
                <Input
                  id="author_name"
                  placeholder="Your name or business name"
                  value={formData.author_name}
                  onChange={(e) => handleChange('author_name', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="author_title">Author Title (optional)</Label>
                <Input
                  id="author_title"
                  placeholder="Founder, Product Expert"
                  value={formData.author_title}
                  onChange={(e) => handleChange('author_title', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="author_bio">Author Bio (optional)</Label>
                <Textarea
                  id="author_bio"
                  placeholder="Brief bio"
                  value={formData.author_bio}
                  onChange={(e) => handleChange('author_bio', e.target.value)}
                  rows={3}
                  maxLength={500}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Draft Recovery Dialog */}
      <AlertDialog
        open={showRecoveryDialog}
        onOpenChange={setShowRecoveryDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recover Draft?</AlertDialogTitle>
            <AlertDialogDescription>
              We found an unsaved draft from a previous session. Would you like
              to restore it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={discardRecoveredDraft}>
              Discard
            </AlertDialogCancel>
            <AlertDialogAction onClick={recoverDraft}>
              Recover Draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
