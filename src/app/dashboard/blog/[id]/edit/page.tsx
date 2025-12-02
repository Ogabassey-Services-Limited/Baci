'use client';

import {
  Archive,
  ArrowLeft,
  ExternalLink,
  Eye,
  Loader2,
  Save,
  Send,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useMerchant } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import { asRoute } from '@/lib/routes';

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

  const handleChange = (field: keyof PostFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
        keywords: formData.keywords
          ? formData.keywords
              .split(',')
              .map((k) => k.trim())
              .filter(Boolean)
          : [],
        author_name: formData.author_name,
        author_title: formData.author_title || undefined,
        author_bio: formData.author_bio || undefined,
        seo_title: formData.seo_title || undefined,
        seo_description: formData.seo_description || undefined,
        focus_keyword: formData.focus_keyword || undefined,
        status: newStatus || formData.status,
      };

      const response = await fetch(`/api/merchant/blog/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update post');
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

  // Calculate SEO metrics
  const titleLength = formData.seo_title?.length || formData.title.length;
  const descriptionLength =
    formData.seo_description?.length || formData.excerpt.length;
  const wordCount = formData.content.split(/\s+/).filter(Boolean).length;
  const readingTime = Math.ceil(wordCount / 200);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
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
          {formData.status === 'published' && merchant?.slug && (
            <Button variant="outline" asChild>
              <a
                href={`/${merchant.slug}/blog/${formData.slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Live
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => savePost()}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
          {formData.status === 'draft' && (
            <Button onClick={() => savePost('published')} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
                <Textarea
                  id="content"
                  placeholder="Write your blog post content here... (Markdown supported)"
                  value={formData.content}
                  onChange={(e) => handleChange('content', e.target.value)}
                  rows={20}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Tip: Use Markdown for formatting. **bold**, *italic*, #
                  headings, etc.
                </p>
              </div>

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
              <div className="space-y-2">
                <Label htmlFor="featured_image_url">Image URL</Label>
                <Input
                  id="featured_image_url"
                  placeholder="https://..."
                  value={formData.featured_image_url}
                  onChange={(e) =>
                    handleChange('featured_image_url', e.target.value)
                  }
                />
              </div>

              {formData.featured_image_url && (
                <div className="relative inline-block">
                  <img
                    src={formData.featured_image_url}
                    alt="Preview"
                    className="max-w-md rounded-lg border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => handleChange('featured_image_url', '')}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}

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
                    {titleLength}/60 characters (recommended)
                  </span>
                  {titleLength >= 50 && titleLength <= 60 && (
                    <span className="text-green-600">Good length!</span>
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
                    {descriptionLength}/160 characters (recommended)
                  </span>
                  {descriptionLength >= 120 && descriptionLength <= 160 && (
                    <span className="text-green-600">Good length!</span>
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
                    {merchant?.slug}.usebaci.com/blog/
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
    </div>
  );
}
