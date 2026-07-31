'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMerchant } from '@/hooks/use-merchant-client';
import { useToast } from '@/hooks/use-toast';
import { asRoute } from '@/lib/routes';
import { getPreviewUrl } from '../actions';
import { NewBlogPostAuthorTab } from './new-blog-post-author-tab';
import { getNewBlogPostContentStats } from './new-blog-post-content-stats';
import { NewBlogPostContentTab } from './new-blog-post-content-tab';
import { createEmptyPostFormData } from './new-blog-post-form-data';
import { NewBlogPostHeader } from './new-blog-post-header';
import { NewBlogPostRecoveryDialog } from './new-blog-post-recovery-dialog';
import { createBlogPost } from './new-blog-post-requests';
import { NewBlogPostSeoTab } from './new-blog-post-seo-tab';
import type {
  NewBlogPostFormData,
  NewBlogProduct,
  UploadedFeaturedImage,
} from './new-blog-post-types';
import { useNewBlogPostDraftRecovery } from './use-new-blog-post-draft-recovery';
import { useNewBlogPostMediaActions } from './use-new-blog-post-media-actions';

export default function NewBlogPostPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { merchant } = useMerchant();
  const [formData, setFormData] = useState<NewBlogPostFormData>(() =>
    createEmptyPostFormData(merchant?.business_name || '')
  );
  const [draftMerchantId, setDraftMerchantId] = useState(merchant?.id);
  const businessName = merchant?.business_name || '';
  const [prevBusinessName, setPrevBusinessName] = useState(businessName);
  if (businessName !== prevBusinessName) {
    setPrevBusinessName(businessName);
    if (businessName && !formData.author_name) {
      setFormData((previous) =>
        previous.author_name
          ? previous
          : { ...previous, author_name: businessName }
      );
    }
  }

  const [embeddedProducts, setEmbeddedProducts] = useState<NewBlogProduct[]>(
    []
  );
  const [contentResetKey, setContentResetKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('content');
  const [uploadedFeaturedImage, setUploadedFeaturedImage] =
    useState<UploadedFeaturedImage | null>(null);
  if (merchant?.id !== draftMerchantId) {
    setDraftMerchantId(merchant?.id);
    setFormData(createEmptyPostFormData(businessName));
    setEmbeddedProducts([]);
    setUploadedFeaturedImage(null);
  }
  const {
    clearSavedData,
    discardRecoveredDraft,
    recoverDraft,
    setShowRecoveryDialog,
    showRecoveryDialog,
  } = useNewBlogPostDraftRecovery({
    businessName,
    formData,
    merchantId: merchant?.id,
    setEditorResetKey: setContentResetKey,
    setFormData,
    setUploadedFeaturedImage,
    toast,
  });
  const handleTitleChange = (title: string) => {
    setFormData((previous) => ({
      ...previous,
      title,
      slug: title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 200),
    }));
  };
  const handleChange = (field: keyof NewBlogPostFormData, value: string) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
  };
  const mediaActions = useNewBlogPostMediaActions({
    uploadedFeaturedImage,
    setFormData,
    setUploadedFeaturedImage,
    toast,
  });
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
    const validationError = validateForm();
    if (validationError) {
      toast({
        title: 'Validation Error',
        description: validationError,
        variant: 'destructive',
      });
      return null;
    }
    setIsSaving(true);
    try {
      const savedPost = await createBlogPost({
        status,
        formData,
        embeddedProducts,
        merchantId: merchant?.id,
      });
      toast({
        title: status === 'published' ? 'Post Published!' : 'Draft Saved',
        description:
          status === 'published'
            ? 'Your blog post is now live.'
            : 'Your draft has been saved.',
      });
      clearSavedData();
      if (shouldRedirect) router.push(asRoute('/dashboard/blog'));
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
    const savedPost = await savePost('draft', false);
    if (!savedPost) return;
    try {
      const previewUrl = await getPreviewUrl(merchant.slug, savedPost.slug);
      window.open(previewUrl, '_blank');
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
  const { wordCount, readingTime } = getNewBlogPostContentStats(
    formData.content
  );

  return (
    <div className="space-y-6">
      <NewBlogPostHeader
        wordCount={wordCount}
        readingTime={readingTime}
        isSaving={isSaving}
        onPreview={() => void handlePreview()}
        onSaveDraft={() => void savePost('draft')}
        onPublish={() => void savePost('published')}
      />
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="author">Author</TabsTrigger>
        </TabsList>
        <TabsContent value="content" className="space-y-6">
          <NewBlogPostContentTab
            formData={formData}
            contentResetKey={contentResetKey}
            merchantId={merchant?.id}
            merchantSlug={merchant?.slug}
            embeddedProducts={embeddedProducts}
            setEmbeddedProducts={setEmbeddedProducts}
            handleTitleChange={handleTitleChange}
            handleChange={handleChange}
            onImageUpload={mediaActions.handleImageUpload}
            onFeaturedImageUpload={mediaActions.handleFeaturedImageUpload}
            onRemoveFeaturedImage={mediaActions.handleRemoveFeaturedImage}
            isUploading={mediaActions.isUploading}
          />
        </TabsContent>
        <TabsContent value="seo" className="space-y-6">
          <NewBlogPostSeoTab
            formData={formData}
            merchant={merchant}
            handleChange={handleChange}
          />
        </TabsContent>
        <TabsContent value="author" className="space-y-6">
          <NewBlogPostAuthorTab
            formData={formData}
            handleChange={handleChange}
          />
        </TabsContent>
      </Tabs>
      <NewBlogPostRecoveryDialog
        open={showRecoveryDialog}
        setOpen={setShowRecoveryDialog}
        onDiscard={discardRecoveredDraft}
        onRecover={recoverDraft}
      />
    </div>
  );
}
