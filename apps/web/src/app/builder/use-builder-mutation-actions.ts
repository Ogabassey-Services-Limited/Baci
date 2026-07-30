import type { Data } from '@puckeditor/core';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useRef } from 'react';
import type { SEOData } from '@/components/builder/seo-panel';
import type { SetupSettings } from '@/components/builder/setup-panel';
import type { StoreSettings } from '@/components/builder/store-settings-panel';
import type { BuilderDegradedReason } from '@/schemas/builder';
import type { BuilderPreviewMode, BuilderToast } from './builder-client-types';
import { getReadOnlyBuilderDescription } from './builder-descriptions';
import { createBuilderMutationCoordinator } from './builder-mutation-coordinator';
import { publishBuilderDraft } from './publish-builder-draft';
import { saveBuilderDraft } from './save-builder-draft';

interface BuilderMutationActionsParams {
  canEdit: boolean;
  data: Data | null;
  degradedReason: BuilderDegradedReason | null;
  expectedLastUpdated: string | null;
  merchantId: string | null;
  previewMode: BuilderPreviewMode;
  seoData: SEOData;
  setLastUpdated: Dispatch<SetStateAction<string | null>>;
  setPublishing: Dispatch<SetStateAction<boolean>>;
  setSaving: Dispatch<SetStateAction<boolean>>;
  setupSettings: SetupSettings;
  storeSettings: StoreSettings;
  toast: BuilderToast;
}

export function useBuilderMutationActions({
  canEdit,
  data,
  degradedReason,
  expectedLastUpdated,
  merchantId,
  previewMode,
  seoData,
  setLastUpdated,
  setPublishing,
  setSaving,
  setupSettings,
  storeSettings,
  toast,
}: BuilderMutationActionsParams) {
  const coordinatorRef = useRef<ReturnType<
    typeof createBuilderMutationCoordinator
  > | null>(null);
  const stateResetMerchantRef = useRef(merchantId);
  if (!coordinatorRef.current) {
    coordinatorRef.current = createBuilderMutationCoordinator(merchantId);
  }
  const coordinator = coordinatorRef.current;
  coordinator.synchronizeMerchant(merchantId);

  useEffect(() => {
    if (stateResetMerchantRef.current === merchantId) return;
    stateResetMerchantRef.current = merchantId;
    setSaving(false);
    setPublishing(false);
  }, [merchantId, setPublishing, setSaving]);

  async function handleSave(newData: Data): Promise<string | null> {
    if (!merchantId || !canEdit) {
      toast({
        title: 'Builder is read-only',
        description: getReadOnlyBuilderDescription(previewMode, degradedReason),
        variant: 'destructive',
      });
      return null;
    }
    const isCurrentRequest = coordinator.start(merchantId);
    if (!isCurrentRequest) return null;
    try {
      return await saveBuilderDraft({
        merchantId,
        isCurrentRequest,
        newData,
        seoData,
        storeSettings,
        setupSettings,
        expectedLastUpdated,
        setLastUpdated,
        setSaving,
        toast,
      });
    } finally {
      coordinator.finish(isCurrentRequest);
    }
  }

  async function handlePublish() {
    if (!data || !merchantId || !canEdit) {
      if (!canEdit) {
        toast({
          title: 'Builder is read-only',
          description: getReadOnlyBuilderDescription(
            previewMode,
            degradedReason
          ),
          variant: 'destructive',
        });
      }
      return;
    }
    const isCurrentRequest = coordinator.start(merchantId);
    if (!isCurrentRequest) return;
    setPublishing(true);
    try {
      const savedLastUpdated = await saveBuilderDraft({
        merchantId,
        isCurrentRequest,
        newData: data,
        seoData,
        storeSettings,
        setupSettings,
        expectedLastUpdated,
        setLastUpdated,
        setSaving,
        toast,
      });
      if (!isCurrentRequest() || !savedLastUpdated) {
        if (isCurrentRequest()) setPublishing(false);
        return;
      }
      await publishBuilderDraft({
        merchantId,
        isCurrentRequest,
        expectedLastUpdated: savedLastUpdated,
        setLastUpdated,
        setPublishing,
        toast,
      });
    } finally {
      coordinator.finish(isCurrentRequest);
    }
  }

  return { handlePublish, handleSave };
}
