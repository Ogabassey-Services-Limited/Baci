'use client';

import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { fetchWithCsrf } from '@/lib/api-client';
import {
  createPlatformBlogPost,
  getPlatformBlogPost,
  updatePlatformBlogPost,
} from './blog-api';
import { BlogEditorFields } from './blog-editor-fields';
import {
  DEFAULT_PLATFORM_BLOG_FORM_STATE,
  type PlatformAdminBlogFormState,
} from './blog-types';

type BlogEditorClientProps = {
  mode: 'create' | 'edit';
  postId?: string;
};

type BlogMediaUploadResult = {
  height?: number | null;
  url: string;
  variants?: Record<string, string>;
  width?: number | null;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function uploadBlogMedia(
  file: File,
  purpose: 'featured' | 'inline'
): Promise<BlogMediaUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', purpose);

  const response = await fetchWithCsrf('/api/admin/blog/upload', {
    body: formData,
    method: 'POST',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error || 'Failed to upload image');
  }

  const payload = (await response.json()) as Partial<BlogMediaUploadResult>;
  if (!payload.url) {
    throw new Error('Upload response did not include a URL');
  }

  return {
    height: payload.height ?? null,
    url: payload.url,
    variants: payload.variants ?? {},
    width: payload.width ?? null,
  };
}

export function BlogEditorClient({ mode, postId }: BlogEditorClientProps) {
  const isEditMode = mode === 'edit';
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [uploadingFeatured, setUploadingFeatured] = useState(false);
  const [form, setForm] = useState<PlatformAdminBlogFormState>(
    DEFAULT_PLATFORM_BLOG_FORM_STATE
  );

  useEffect(() => {
    if (!isEditMode || !postId) {
      return;
    }

    let cancelled = false;
    const loadPost = async () => {
      try {
        const post = await getPlatformBlogPost(postId);
        if (cancelled) return;
        setForm({
          author_name: post.author_name || 'Baci Editorial',
          category: post.category || '',
          content: post.content || '',
          excerpt: post.excerpt || '',
          featured_image_alt: post.featured_image_alt || '',
          featured_image_height: post.featured_image_height ?? null,
          featured_image_url: post.featured_image_url || '',
          featured_image_variants: post.featured_image_variants ?? {},
          featured_image_width: post.featured_image_width ?? null,
          seo_description: post.seo_description || '',
          seo_title: post.seo_title || '',
          slug: post.slug,
          status: post.status,
          tags: post.tags?.join(', ') || '',
          title: post.title,
        });
      } catch (error) {
        if (!cancelled) {
          toast({
            title: 'Failed to load post',
            description:
              error instanceof Error ? error.message : 'Unknown error',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPost();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, postId, toast]);

  const pageTitle = useMemo(
    () => (isEditMode ? 'Edit Platform Blog Post' : 'New Platform Blog Post'),
    [isEditMode]
  );

  const handleUploadFeatured = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;

      setUploadingFeatured(true);
      uploadBlogMedia(file, 'featured')
        .then((upload) => {
          setForm((current) => ({
            ...current,
            featured_image_height: upload.height ?? null,
            featured_image_url: upload.url,
            featured_image_variants: upload.variants ?? {},
            featured_image_width: upload.width ?? null,
          }));
          toast({ title: 'Featured image uploaded' });
        })
        .catch((error) => {
          toast({
            title: 'Upload failed',
            description:
              error instanceof Error ? error.message : 'Unknown error',
            variant: 'destructive',
          });
        })
        .finally(() => {
          setUploadingFeatured(false);
        });
    };
    input.click();
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      if (!form.title.trim() || !form.content.trim()) {
        throw new Error('Title and content are required');
      }

      const payload: PlatformAdminBlogFormState = {
        ...form,
        slug: form.slug.trim() || slugify(form.title),
      };

      if (isEditMode && postId) {
        await updatePlatformBlogPost(postId, payload);
      } else {
        await createPlatformBlogPost(payload);
      }

      toast({ title: isEditMode ? 'Post updated' : 'Post created' });
      router.push('/admin/blog');
      router.refresh();
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading post...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/admin/blog">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to posts
          </Link>
        </Button>
        <h1 className="text-page-title">{pageTitle}</h1>
      </div>

      <BlogEditorFields
        form={form}
        isEditMode={isEditMode}
        onContentChange={(content) => {
          setForm((current) => ({ ...current, content }));
        }}
        onFormChange={(updater) => {
          setForm((current) =>
            typeof updater === 'function' ? updater(current) : updater
          );
        }}
        onInlineImageUpload={(file) =>
          uploadBlogMedia(file, 'inline').then((upload) => upload.url)
        }
        onSubmit={handleSubmit}
        onUploadFeatured={handleUploadFeatured}
        saving={saving}
        uploadingFeatured={uploadingFeatured}
      />
    </div>
  );
}
