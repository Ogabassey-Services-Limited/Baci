'use client';

import type { Data } from '@puckeditor/core';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { SEOData } from '@/components/builder/seo-panel';
import type { SetupSettings } from '@/components/builder/setup-panel';
import type { StoreSettings } from '@/components/builder/store-settings-panel';
import { useCopilotBuilderActions } from '@/components/builder/use-copilot-builder-actions';
import { useAuth } from '@/contexts/auth-context';
import { useMerchant } from '@/hooks/use-merchant-client';
import { useToast } from '@/hooks/use-toast';
import type { ThemeConfiguration } from '@/lib/theme-config';
import type { BuilderDegradedReason } from '@/schemas/builder';
import { createDefaultBuilderSettings } from './builder-default-settings';
import { ensureBuilderComponentIds } from './ensure-builder-component-ids';
import { loadBuilderData } from './load-builder-data';
import { useBuilderAiDraftActions } from './use-builder-ai-draft-actions';
import { useBuilderLoadMerchantId } from './use-builder-load-merchant-id';
import { useBuilderMutationActions } from './use-builder-mutation-actions';

export function useBuilderClientController() {
  const [data, setData] = useState<Data>({
    content: [],
    root: { title: 'Home' },
    zones: {},
  });
  const [viewportWidth, setViewportWidth] = useState<string | number>('100%');
  const [seoData, setSeoData] = useState<SEOData>({
    title: '',
    description: '',
    keywords: '',
    twitterCard: 'summary_large_image',
  });
  const [initialBuilderSettings] = useState(createDefaultBuilderSettings);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(
    initialBuilderSettings.storeSettings
  );
  const [setupSettings, setSetupSettings] = useState<SetupSettings>(
    initialBuilderSettings.setupSettings
  );
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showFieldsSidebar, setShowFieldsSidebar] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(true);
  const [degradedReason, setDegradedReason] =
    useState<BuilderDegradedReason | null>(null);
  const [previewMode, setPreviewMode] = useState<'ai_draft' | null>(null);
  const [aiDraftJobId, setAiDraftJobId] = useState<string | null>(null);
  const [canApplyAiDraft, setCanApplyAiDraft] = useState(false);
  const [applyingAiDraft, setApplyingAiDraft] = useState(false);
  const [showStaleAiDraftDialog, setShowStaleAiDraftDialog] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { merchant, loading: merchantLoading } = useMerchant();
  const userId = user?.id ?? null;
  const merchantId = merchant?.id ?? null;
  const builderLoadMerchantId = useBuilderLoadMerchantId({
    authLoading,
    merchantId,
    merchantLoading,
    userId,
  });

  useCopilotBuilderActions({ data, setData });

  useEffect(() => {
    if (!authLoading && !userId) router.push('/login');
  }, [userId, authLoading, router]);

  const isResolvedWithoutTarget =
    !authLoading && !merchantLoading && (!userId || !merchantId);
  const [prevResolvedWithoutTarget, setPrevResolvedWithoutTarget] =
    useState(false);
  if (isResolvedWithoutTarget !== prevResolvedWithoutTarget) {
    setPrevResolvedWithoutTarget(isResolvedWithoutTarget);
    if (isResolvedWithoutTarget) setPageLoading(false);
  }

  const loadTargetKey =
    !authLoading && !merchantLoading && userId && merchantId
      ? `${userId}::${merchantId}`
      : null;
  const [prevLoadTargetKey, setPrevLoadTargetKey] = useState<string | null>(
    null
  );
  if (loadTargetKey !== prevLoadTargetKey) {
    setPrevLoadTargetKey(loadTargetKey);
    if (loadTargetKey) setPageLoading(true);
  }

  useEffect(() => {
    if (authLoading || merchantLoading || !userId || !builderLoadMerchantId) {
      return;
    }
    const controller = new AbortController();
    void loadBuilderData({
      merchantId: builderLoadMerchantId,
      router,
      signal: controller.signal,
      toast,
      setData,
      setSeoData,
      setStoreSettings,
      setSetupSettings,
      setPageLoading,
      setLastUpdated,
      setCanEdit,
      setDegradedReason,
      setPreviewMode,
      setAiDraftJobId,
      setCanApplyAiDraft,
    });
    return () => controller.abort();
  }, [
    userId,
    builderLoadMerchantId,
    authLoading,
    merchantLoading,
    router,
    toast,
  ]);

  const { handlePublish, handleSave } = useBuilderMutationActions({
    canEdit,
    data,
    degradedReason,
    expectedLastUpdated: lastUpdated,
    merchantId,
    previewMode,
    seoData,
    setLastUpdated,
    setPublishing,
    setSaving,
    setupSettings,
    storeSettings,
    toast,
  });
  const { applyAiDraft, handleAiCommand } = useBuilderAiDraftActions({
    aiDraftJobId,
    canApplyAiDraft,
    canEdit,
    data,
    degradedReason,
    merchantId,
    previewMode,
    router,
    setAiDraftJobId,
    setApplyingAiDraft,
    setCanApplyAiDraft,
    setCanEdit,
    setData,
    setDegradedReason,
    setIsAiLoading,
    setLastUpdated,
    setPreviewMode,
    setShowStaleAiDraftDialog,
    toast,
  });

  const handleDataChange = (newData: Data) => {
    if (canEdit) setData(ensureBuilderComponentIds(newData));
  };
  const setTheme = (theme: ThemeConfiguration) => {
    setData(
      (previous) =>
        ({ ...previous, theme }) as Data & {
          theme: ThemeConfiguration;
        }
    );
  };
  const isAiDraftPreview = previewMode === 'ai_draft';

  return {
    aiDraftJobId,
    applyAiDraft,
    applyingAiDraft,
    authLoading,
    canApplyAiDraft,
    canEdit,
    data,
    degradedReason,
    handleAiCommand,
    handleDataChange,
    handlePublish,
    handleSave,
    isAiDraftPreview,
    isAiLoading,
    merchant,
    merchantLoading,
    pageLoading,
    publishing,
    saving,
    seoData,
    setData,
    setSeoData,
    setSetupSettings,
    setShowFieldsSidebar,
    setShowStaleAiDraftDialog,
    setStoreSettings,
    setTheme,
    setViewportWidth,
    setupSettings,
    shouldBlockBuilder: !canEdit && !isAiDraftPreview,
    showFieldsSidebar,
    showStaleAiDraftDialog,
    storeSettings,
    user,
    viewportWidth,
  };
}
