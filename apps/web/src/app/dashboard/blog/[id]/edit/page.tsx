'use client';

import {
  Archive,
  ArrowLeft,
  ExternalLink,
  Eye,
  // Loader2,
  Save,
  Send,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { BagLoader } from '@/components/ui/bag-loader';
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
import { getRootDomain } from '@/env';
import { useBlogAutoSave } from '@/hooks/use-blog-auto-save';
import { useMerchant } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import { asRoute } from '@/lib/routes';
import { isSafeSlug } from '@/lib/validate-slug';
import { sanitizeBlogPostData } from '@/lib/validations/blog';
import { getPreviewUrl } from '../../actions';

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
  keywords: string;
  author_name: string;
  author_title: string;
  author_bio: string;
  seo_title: string;
  seo_description: string;
  focus_keyword: string;
  status: 'draft' | 'published' | 'archived';
}

interface BlogPost extends PostFormData {
  id: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  view_count: number;
  word_count: number;
  reading_time_minutes: number;
}

export default function EditBlogPostPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params.id as string;
  const { toast } = useToast();
  const { merchant } = useMerchant();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('content');
  const [embeddedProducts, setEmbeddedProducts] = useState<Product[]>([]);
  const [originalPost, setOriginalPost] = useState<BlogPost | null>(null);
  const [formData, setFormData] = useState<PostFormData>({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    featured_image_url: '',
    featured_image_alt: '',
    category: '',
    tags: '',
    keywords: '',
    author_name: '',
    author_title: '',
    author_bio: '',
    seo_title: '',
    seo_description: '',
    focus_keyword: '',
    status: 'draft',
  });
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [preRecoveryData, setPreRecoveryData] = useState<PostFormData | null>(
    null
  ); // For undo functionality
  const hasCheckedForRecovery = useRef(false);

  // Auto-save to localStorage (protects against Chrome Memory Saver)
  const { clearSavedData, hasSavedData, getSavedData } = useBlogAutoSave({
    storageKey: `blog-draft-edit-${postId}`,
    data: formData,
    enabled: !isLoading, // Don't auto-save during initial load
  });

  const recoverDraft = () => {
    const saved = getSavedData();
    if (saved) {
      setFormData(saved.data);
      toast({
        title: 'Draft Recovered',
        description: 'Your unsaved changes have been restored.',
      });
    }
    setShowRecoveryDialog(false);
  };

  const discardRecoveredDraft = useCallback(() => {
    clearSavedData();
    setShowRecoveryDialog(false);
  }, [clearSavedData]);

  // Undo auto-recovery - restore the original database state
  const undoRecovery = useCallback(() => {
    if (preRecoveryData) {
      setFormData(preRecoveryData);
      clearSavedData();
      setPreRecoveryData(null);
      toast({
        title: 'Recovery Undone',
        description: 'Restored to the last saved version.',
      });
    }
  }, [preRecoveryData, clearSavedData, toast]);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const response = await fetch(`/api/merchant/blog/posts/${postId}`);
        if (!response.ok) {
          if (response.status === 404) {
            toast({ title: 'Post not found', variant: 'destructive' });
            router.push(asRoute('/dashboard/blog'));
            return;
          }
          throw new Error('Failed to fetch post');
        }

        const post = await response.json();
        setOriginalPost(post);
        setFormData({
          title: post.title || '',
          slug: post.slug || '',
          content: post.content || '',
          excerpt: post.excerpt || '',
          featured_image_url: post.featured_image_url || '',
          featured_image_alt: post.featured_image_alt || '',
          category: post.category || '',
          tags: Array.isArray(post.tags) ? post.tags.join(', ') : '',
          keywords: Array.isArray(post.keywords)
            ? post.keywords.join(', ')
            : '',
          author_name: post.author_name || '',
          author_title: post.author_title || '',
          author_bio: post.author_bio || '',
          seo_title: post.seo_title || '',
          seo_description: post.seo_description || '',
          focus_keyword: post.focus_keyword || '',
          status: post.status || 'draft',
        });

        // Fetch embedded products if any
        if (
          post.embedded_products &&
          Array.isArray(post.embedded_products) &&
          post.embedded_products.length > 0
        ) {
          const productsResponse = await fetch(
            `/api/products?ids=${post.embedded_products.join(',')}`
          );
          if (productsResponse.ok) {
            const data = await productsResponse.json();
            setEmbeddedProducts(data.products || []);
          }
        }
      } catch (error) {
        console.error('Error fetching post:', error);
        toast({
          title: 'Error',
          description: 'Failed to load blog post.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (postId) {
      fetchPost();
    }
  }, [postId, router, toast]);

  // Silent auto-recovery after initial load (no blocking dialog)
  useEffect(() => {
    if (!isLoading && hasSavedData() && !hasCheckedForRecovery.current) {
      hasCheckedForRecovery.current = true;
      const saved = getSavedData();
      if (saved) {
        // Store current data for undo functionality
        setPreRecoveryData({ ...formData });
        // Silently restore the draft
        setFormData(saved.data);
        // Show non-blocking toast with undo option
        toast({
          title: 'Draft Recovered',
          description: 'Your unsaved changes have been restored.',
          action: (
            <button
              type="button"
              onClick={undoRecovery}
              className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
            >
              Undo
            </button>
          ),
          duration: 8000, // Give user time to read and click undo
        });
      }
    }
  }, [isLoading, hasSavedData, getSavedData, formData, toast, undoRecovery]);

  const handleChange = useCallback(
    (field: keyof PostFormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const [isUploading, setIsUploading] = useState(false);

  // Handle featured image selection and upload
  const handleFeaturedImageUpload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      setIsUploading(true);
      const file = files[0];
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      try {
        const response = await fetch('/api/merchant/blog/upload', {
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
    },
    [handleChange, toast]
  );

  // Image upload handler for the editor
  const handleImageUpload = useCallback(async (file: File): Promise<string> => {
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    const response = await fetch('/api/merchant/blog/upload', {
      method: 'POST',
      body: formDataUpload,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload image');
    }

    const data = await response.json();
    return data.url;
  }, []);

  const validateForm = (): string | null => {
    // Sanitize data first
    const sanitizedData = sanitizeBlogPostData({
      ...formData,
      slug:
        formData.slug && formData.slug !== originalPost?.slug
          ? formData.slug
          : undefined,
    });

    const result = blogPostSchema.safeParse(sanitizedData);

    if (!result.success) {
      const firstError = result.error.errors[0];
      return firstError?.message || 'Invalid form data';
    }

    return null;
  };

  const savePost = async (newStatus?: 'draft' | 'published' | 'archived') => {
    const error = validateForm();
    if (error) {
      toast({
        title: 'Validation Error',
        description: error,
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const rawPostData = {
        title: formData.title.trim(),
        slug:
          formData.slug && formData.slug !== originalPost?.slug
            ? formData.slug
            : undefined,
        content: formData.content,
        excerpt: formData.excerpt,
        featured_image_url: formData.featured_image_url,
        featured_image_alt: formData.featured_image_alt,
        category: formData.category,
        tags: formData.tags ? formData.tags.split(',') : [],
        keywords: formData.keywords ? formData.keywords.split(',') : [],
        author_name: formData.author_name,
        author_title: formData.author_title,
        author_bio: formData.author_bio,
        seo_title: formData.seo_title,
        seo_description: formData.seo_description,
        focus_keyword: formData.focus_keyword,
        status: newStatus || formData.status,
        embedded_products: embeddedProducts.map((p) => p.id),
      };

      const postData = sanitizeBlogPostData(rawPostData);

      const response = await fetch(`/api/merchant/blog/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData),
      });

      if (!response.ok) {
        const data = await response.json();
        const errorMessage = data.details?.fieldErrors
          ? Object.values(data.details.fieldErrors)[0]?.[0]
          : data.error;

        throw new Error(errorMessage || 'Failed to update post');
      }

      const updatedPost = await response.json();
      setOriginalPost(updatedPost);
      setFormData((prev) => ({ ...prev, status: updatedPost.status }));

      const statusMessages: Record<string, string> = {
        published: 'Your blog post is now live.',
        draft: 'Your post has been saved as a draft.',
        archived: 'Your post has been archived.',
      };

      toast({
        title: newStatus === 'published' ? 'Post Published!' : 'Changes Saved',
        description:
          statusMessages[newStatus || formData.status] ||
          'Your changes have been saved.',
      });

      // Clear auto-saved draft on successful server save
      clearSavedData();
    } catch (error) {
      console.error('Error saving post:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save blog post.',
        variant: 'destructive',
      });
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

    // Always save as draft first to ensure the latest content is available in preview
    await savePost('draft');

    try {
      const previewUrl = await getPreviewUrl(merchant.slug, formData.slug);
      window.open(previewUrl, '_blank');
    } catch (error) {
      console.error('Error getting preview URL:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate preview link.',
        variant: 'destructive',
      });
    }
  };
  const titleLength = formData.seo_title?.length || formData.title.length;
  const descriptionLength =
    formData.seo_description?.length || formData.excerpt.length;

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <BagLoader size={32} />
      </div>
    );
  }

  const statusBadgeVariant = {
    published: 'default' as const,
    draft: 'secondary' as const,
    archived: 'outline' as const,
  };

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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Edit Post</h1>
              <Badge variant={statusBadgeVariant[formData.status]}>
                {formData.status.charAt(0).toUpperCase() +
                  formData.status.slice(1)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {wordCount} words | {readingTime} min read
              {originalPost?.view_count
                ? ` | ${originalPost.view_count} views`
                : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePreview} disabled={isSaving}>
            {isSaving ? (
              <BagLoader size={16} />
            ) : (
              <Eye className="w-4 h-4 mr-2" />
            )}
            Preview
          </Button>
          {formData.status === 'published' &&
            merchant?.slug &&
            isSafeSlug(merchant.slug) && (
              <Button variant="outline" asChild>
                <a
                  href={
                    merchant.custom_domain
                      ? `https://${merchant.custom_domain.replace(/\/$/, '')}/blog/${encodeURIComponent(formData.slug)}`
                      : `/${encodeURIComponent(merchant.slug)}/blog/${encodeURIComponent(formData.slug)}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Live
                </a>
              </Button>
            )}
          <Button
            variant="outline"
            onClick={() => savePost()}
            disabled={isSaving}
          >
            {isSaving ? (
              <BagLoader size={16} />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
          {formData.status === 'draft' && (
            <Button onClick={() => savePost('published')} disabled={isSaving}>
              {isSaving ? (
                <BagLoader size={16} />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Publish
            </Button>
          )}
          {formData.status === 'published' && (
            <Button
              variant="secondary"
              onClick={() => savePost('draft')}
              disabled={isSaving}
            >
              Unpublish
            </Button>
          )}
          {formData.status !== 'archived' && (
            <Button
              variant="ghost"
              onClick={() => savePost('archived')}
              disabled={isSaving}
            >
              <Archive className="w-4 h-4 mr-2" />
              Archive
            </Button>
          )}
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
              <CardDescription>Edit your blog post content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter post title"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
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
                    placeholder="post-url-slug"
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
                <Label htmlFor="content">Content *</Label>
                <BlogEditor
                  content={formData.content}
                  onChange={(content) => handleChange('content', content)}
                  onImageUpload={handleImageUpload}
                  onProductsChange={setEmbeddedProducts}
                  embeddedProducts={embeddedProducts}
                  placeholder="Start writing... Drag and drop images, or click the shopping bag icon to embed products."
                />
              </div>

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

              <div className="space-y-2">
                <Label htmlFor="excerpt">Excerpt</Label>
                <Textarea
                  id="excerpt"
                  placeholder="Brief summary of the post (used in listings and meta description)"
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

          <Card>
            <CardHeader>
              <CardTitle>Featured Image</CardTitle>
              <CardDescription>
                Add a featured image for your post (min 1200px wide for Google
                Discover)
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
                    <BagLoader size={16} />
                    Uploading image...
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="featured_image_alt">Alt Text</Label>
                <Input
                  id="featured_image_alt"
                  placeholder="Describe the image for accessibility"
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
              <CardTitle>Organization</CardTitle>
              <CardDescription>Categorize your post</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  placeholder="Product News, Tutorials, Industry Insights"
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  placeholder="Separate tags with commas"
                  value={formData.tags}
                  onChange={(e) => handleChange('tags', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  e.g., tech, gadgets, reviews
                </p>
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
                Optimize your post for search engines and Google Discover
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="seo_title">SEO Title</Label>
                <Input
                  id="seo_title"
                  placeholder={formData.title || 'Custom SEO title'}
                  value={formData.seo_title}
                  onChange={(e) => handleChange('seo_title', e.target.value)}
                />
                <div className="flex justify-between items-center text-xs">
                  <span className={titleLength > 60 ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                    {titleLength}/60 characters (recommended)
                  </span>
                  {titleLength >= 50 && titleLength <= 60 && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-none">
                      Optimized for SEO
                    </Badge>
                  )}
                  {titleLength > 70 && (
                    <Badge variant="destructive" className="animate-pulse">
                      Too Long
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo_description">Meta Description</Label>
                <Textarea
                  id="seo_description"
                  placeholder={formData.excerpt || 'Custom meta description'}
                  value={formData.seo_description}
                  onChange={(e) =>
                    handleChange('seo_description', e.target.value)
                  }
                  rows={3}
                />
                <div className="flex justify-between items-center text-xs">
                  <span className={descriptionLength > 150 ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                    {descriptionLength}/150 characters (recommended)
                  </span>
                  {descriptionLength >= 120 && descriptionLength <= 150 && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-none">
                      Optimized for Google/Social
                    </Badge>
                  )}
                  {descriptionLength > 160 && (
                    <Badge variant="destructive" className="animate-pulse">
                      Exceeds Limit
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="focus_keyword">Focus Keyword</Label>
                <Input
                  id="focus_keyword"
                  placeholder="Primary keyword to target"
                  value={formData.focus_keyword}
                  onChange={(e) =>
                    handleChange('focus_keyword', e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="keywords">SEO Keywords</Label>
                <Input
                  id="keywords"
                  placeholder="Separate keywords with commas"
                  value={formData.keywords}
                  onChange={(e) => handleChange('keywords', e.target.value)}
                />
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
                      ? `https://${merchant.custom_domain.replace(/\/$/, '')}/blog/`
                      : merchant?.slug
                        ? `https://${getRootDomain() ?? 'usebaci.com'}/${merchant.slug}/blog/`
                        : '/blog/'}
                    {formData.slug || 'post-slug'}
                  </div>
                  <div className="text-sm text-muted-foreground line-clamp-2">
                    {formData.seo_description ||
                      formData.excerpt ||
                      'Post description will appear here...'}
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
              <CardDescription>
                Author details for E-E-A-T (Experience, Expertise,
                Authoritativeness, Trustworthiness)
              </CardDescription>
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
                <Label htmlFor="author_title">Author Title</Label>
                <Input
                  id="author_title"
                  placeholder="Founder, Product Expert, Marketing Manager"
                  value={formData.author_title}
                  onChange={(e) => handleChange('author_title', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="author_bio">Author Bio</Label>
                <Textarea
                  id="author_bio"
                  placeholder="Brief bio to establish expertise and credibility"
                  value={formData.author_bio}
                  onChange={(e) => handleChange('author_bio', e.target.value)}
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">
                  {formData.author_bio.length}/500 characters
                </p>
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
            <AlertDialogTitle>Recover Unsaved Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              We found unsaved changes from a previous session. Would you like
              to restore them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={discardRecoveredDraft}>
              Discard
            </AlertDialogCancel>
            <AlertDialogAction onClick={recoverDraft}>
              Recover Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
