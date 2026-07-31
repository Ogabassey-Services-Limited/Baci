'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useBlogAutoSave } from '@/hooks/use-blog-auto-save';
import type { useToast } from '@/hooks/use-toast';
import {
  createEmptyPostFormData,
  reconstructUploadedFeaturedImage,
  withFeaturedImageDefaults,
} from './new-blog-post-form-data';
import type {
  NewBlogPostFormData,
  UploadedFeaturedImage,
} from './new-blog-post-types';

function getNewBlogPostDraftStorageKey(merchantId: string | undefined) {
  return merchantId ? `blog-draft-new-${merchantId}` : null;
}

export function useNewBlogPostDraftRecovery({
  businessName,
  formData,
  merchantId,
  setFormData,
  setUploadedFeaturedImage,
  toast,
}: {
  businessName: string;
  formData: NewBlogPostFormData;
  merchantId: string | undefined;
  setFormData: Dispatch<SetStateAction<NewBlogPostFormData>>;
  setUploadedFeaturedImage: Dispatch<
    SetStateAction<UploadedFeaturedImage | null>
  >;
  toast: ReturnType<typeof useToast>['toast'];
}) {
  const storageKey = getNewBlogPostDraftStorageKey(merchantId);
  const activeMerchantIdRef = useRef(merchantId);
  const [hasAutoRecovered, setHasAutoRecovered] = useState(false);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const { clearSavedData, getSavedData, hasSavedData } = useBlogAutoSave({
    storageKey: storageKey ?? 'blog-draft-new-pending',
    data: formData,
    enabled: Boolean(storageKey),
  });

  useEffect(() => {
    activeMerchantIdRef.current = merchantId;
    setHasAutoRecovered(false);
    setShowRecoveryDialog(false);
  }, [merchantId]);

  useEffect(() => {
    if (!storageKey || hasAutoRecovered || !hasSavedData()) return;
    const recoveredMerchantId = merchantId;
    const timer = window.setTimeout(() => {
      if (activeMerchantIdRef.current !== recoveredMerchantId) return;
      const saved = getSavedData();
      if (!saved) return;
      const recoveredData = withFeaturedImageDefaults(saved.data);
      setFormData(recoveredData);
      setUploadedFeaturedImage(
        reconstructUploadedFeaturedImage(recoveredData, recoveredMerchantId)
      );
      setHasAutoRecovered(true);
      toast({
        title: 'Draft Recovered',
        description: 'Your previous work has been restored.',
        action: (
          <button
            type="button"
            onClick={() => {
              if (activeMerchantIdRef.current !== recoveredMerchantId) return;
              setFormData(createEmptyPostFormData(businessName));
              setUploadedFeaturedImage(null);
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
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    businessName,
    clearSavedData,
    getSavedData,
    hasAutoRecovered,
    hasSavedData,
    merchantId,
    setFormData,
    setUploadedFeaturedImage,
    storageKey,
    toast,
  ]);

  const recoverDraft = () => {
    if (!storageKey || activeMerchantIdRef.current !== merchantId) return;
    const saved = getSavedData();
    if (saved) {
      const recoveredData = withFeaturedImageDefaults(saved.data);
      setFormData(recoveredData);
      setUploadedFeaturedImage(
        reconstructUploadedFeaturedImage(recoveredData, merchantId)
      );
      toast({
        title: 'Draft Recovered',
        description: 'Your previous work has been restored.',
      });
    }
    setShowRecoveryDialog(false);
  };

  const discardRecoveredDraft = () => {
    if (!storageKey || activeMerchantIdRef.current !== merchantId) return;
    clearSavedData();
    setShowRecoveryDialog(false);
  };

  return {
    clearSavedData,
    discardRecoveredDraft,
    recoverDraft,
    setShowRecoveryDialog,
    showRecoveryDialog,
  };
}
