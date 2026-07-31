'use client';

import { format } from 'date-fns';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useState } from 'react';
import { BagLoader } from '@/components/ui/bag-loader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBlogAutoSave } from '@/hooks/use-blog-auto-save';
import { useMerchant } from '@/hooks/use-merchant-client';
import { useToast } from '@/hooks/use-toast';
import { asRoute } from '@/lib/routes';
import { blogPostSchema, sanitizeBlogPostData } from '@/lib/validations/blog';
import { getPreviewUrl } from '../../actions';
import { EditBlogAuthorTab } from './edit-blog-author-tab';
import { getBlogContentStats } from './edit-blog-content-stats';
import { EditBlogContentTab } from './edit-blog-content-tab';
import {
  INITIAL_FORM_DATA,
  normalizePostFormData,
  withFeaturedImageDefaults,
} from './edit-blog-form-data';
import { EditBlogHeader } from './edit-blog-header';
import { EditBlogRecoveryDialog } from './edit-blog-recovery-dialog';
import {
  type LoadBlogPostResult,
  loadBlogPost,
  submitBlogPostUpdate,
} from './edit-blog-requests';
import { EditBlogSeoTab } from './edit-blog-seo-tab';
import type { BlogPost, PostFormData, Product } from './edit-blog-types';
import { useEditBlogDraftRecovery } from './use-edit-blog-draft-recovery';
import { useFeaturedImageActions } from './use-featured-image-actions';

export default function EditBlogPostPage() {
  const router = useRouter();
  const postId = useParams().id as string;
  const { toast } = useToast();
  const { merchant } = useMerchant();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('content');
  const [embeddedProducts, setEmbeddedProducts] = useState<Product[]>([]);
  const [originalPost, setOriginalPost] = useState<BlogPost | null>(null);
  const [formData, setFormData] = useState<PostFormData>(INITIAL_FORM_DATA);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const { clearSavedData, hasSavedData, getSavedData } = useBlogAutoSave({
    storageKey: `blog-draft-edit-${postId}`,
    data: formData,
    enabled: !isLoading,
  });
  const imageActions = useFeaturedImageActions({
    merchantId: merchant?.id,
    formData,
    setFormData,
    toast,
  });
  const recoverSavedDraft = useEditBlogDraftRecovery({
    persistence: { clearSavedData, hasSavedData, getSavedData },
    setFormData,
    toast,
  });
  const onPostLoaded = useEffectEvent((result: LoadBlogPostResult) => {
    let loadedFormData: PostFormData | null = null;
    if (result.status === 'not-found') {
      toast({ title: 'Post not found', variant: 'destructive' });
      router.push(asRoute('/dashboard/blog'));
    } else if (result.status === 'error')
      toast({
        title: 'Error',
        description: 'Failed to load blog post.',
        variant: 'destructive',
      });
    else {
      setOriginalPost(result.post);
      setFormData(result.formData);
      loadedFormData = result.formData;
      if (result.post.published_at)
        setScheduledDate(new Date(result.post.published_at));
      if (result.embeddedProducts) setEmbeddedProducts(result.embeddedProducts);
      if (result.productsLoadFailed)
        toast({
          title: 'Error',
          description: 'Failed to load blog post.',
          variant: 'destructive',
        });
    }
    recoverSavedDraft(loadedFormData);
    setIsLoading(false);
  });

  useEffect(() => {
    if (!postId || !merchant?.id) return;
    let isStale = false;
    setIsLoading(true);
    setEmbeddedProducts([]);
    loadBlogPost(postId, merchant.id).then((result) => {
      if (!isStale) onPostLoaded(result);
    });
    return () => {
      isStale = true;
    };
  }, [merchant?.id, postId]);

  const handleChange = (field: keyof PostFormData, value: string) =>
    setFormData((previous) => ({ ...previous, [field]: value }));
  const optimizeSEO = (field: 'seo_title' | 'seo_description') => {
    const value =
      formData[field] ||
      (field === 'seo_title' ? formData.title : formData.excerpt);
    handleChange(field, value.slice(0, field === 'seo_title' ? 70 : 160));
    toast({
      title: 'SEO Optimized',
      description: `The ${field.replace('_', ' ')} has been truncated to 160 characters.`,
    });
  };

  const savePost = async (
    newStatus?: PostFormData['status']
  ): Promise<boolean> => {
    if (!merchant?.id) {
      toast({
        title: 'Merchant unavailable',
        description: 'Wait for the merchant context to load before saving.',
        variant: 'destructive',
      });
      return false;
    }
    const normalizedFormData = normalizePostFormData(formData);
    const validation = blogPostSchema.safeParse(
      sanitizeBlogPostData({
        ...normalizedFormData,
        slug:
          normalizedFormData.slug &&
          normalizedFormData.slug !== originalPost?.slug
            ? normalizedFormData.slug
            : undefined,
      })
    );
    if (!validation.success) {
      toast({
        title: 'Validation Error',
        description:
          validation.error.issues?.[0]?.message || 'Invalid form data',
        variant: 'destructive',
      });
      return false;
    }
    setIsSaving(true);
    try {
      const updatedPost = await submitBlogPostUpdate({
        postId,
        merchantId: merchant.id,
        formData: normalizedFormData,
        originalSlug: originalPost?.slug,
        newStatus,
        scheduledDate,
        embeddedProductIds: embeddedProducts.map((product) => product.id),
      });
      setOriginalPost(updatedPost);
      setFormData((previous) => ({
        ...previous,
        status: updatedPost.status,
        published_at: updatedPost.published_at ?? null,
      }));
      const messages: Record<string, string> = {
        published: 'Your blog post is now live.',
        draft: 'Your post has been saved as a draft.',
        archived: 'Your post has been archived.',
        scheduled: `Your post is scheduled for ${scheduledDate ? format(scheduledDate, 'PPP p') : 'later'}.`,
      };
      toast({
        title: newStatus === 'published' ? 'Post Published!' : 'Changes Saved',
        description:
          messages[newStatus || formData.status] ||
          'Your changes have been saved.',
      });
      clearSavedData();
      return true;
    } catch (error) {
      console.error('Error saving post:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save blog post.',
        variant: 'destructive',
      });
      return false;
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
    if (!(await savePost('draft'))) return;
    try {
      window.open(await getPreviewUrl(merchant.slug, formData.slug), '_blank');
    } catch (error) {
      console.error('Error getting preview URL:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate preview link.',
        variant: 'destructive',
      });
    }
  };
  const suggestSchedule = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    setScheduledDate(tomorrow);
    toast({
      title: 'AI Timing Optimization',
      description: 'Scheduled for tomorrow at 10:00 AM for peak engagement.',
    });
  };
  const stats = getBlogContentStats(formData.content);

  if (isLoading)
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <BagLoader size={32} />
      </div>
    );
  return (
    <div className="space-y-6">
      <EditBlogHeader
        formData={formData}
        merchant={merchant}
        originalPost={originalPost}
        isSaving={isSaving}
        scheduledDate={scheduledDate}
        setScheduledDate={setScheduledDate}
        savePost={savePost}
        onPreview={handlePreview}
        onSuggestSchedule={suggestSchedule}
        {...stats}
      />
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="author">Author</TabsTrigger>
        </TabsList>
        <TabsContent value="content" className="space-y-6">
          <EditBlogContentTab
            formData={formData}
            merchantId={merchant?.id}
            handleChange={handleChange}
            merchantSlug={merchant?.slug}
            embeddedProducts={embeddedProducts}
            setEmbeddedProducts={setEmbeddedProducts}
            onImageUpload={imageActions.handleInlineImageUpload}
            onFeaturedImageUpload={imageActions.handleFeaturedImageUpload}
            onRemoveFeaturedImage={imageActions.handleRemoveFeaturedImage}
            isUploading={imageActions.isUploading}
          />
        </TabsContent>
        <TabsContent value="seo" className="space-y-6">
          <EditBlogSeoTab
            formData={formData}
            merchant={merchant}
            handleChange={handleChange}
            optimizeSEO={optimizeSEO}
          />
        </TabsContent>
        <TabsContent value="author" className="space-y-6">
          <EditBlogAuthorTab formData={formData} handleChange={handleChange} />
        </TabsContent>
      </Tabs>
      <EditBlogRecoveryDialog
        open={showRecoveryDialog}
        setOpen={setShowRecoveryDialog}
        onDiscard={() => {
          clearSavedData();
          setShowRecoveryDialog(false);
        }}
        onRecover={() => {
          const saved = getSavedData();
          if (saved) {
            setFormData(withFeaturedImageDefaults(saved.data));
            toast({
              title: 'Draft Recovered',
              description: 'Your unsaved changes have been restored.',
            });
          }
          setShowRecoveryDialog(false);
        }}
      />
    </div>
  );
}
