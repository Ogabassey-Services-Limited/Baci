import type { Data } from '@puckeditor/core';
import type { Dispatch, SetStateAction } from 'react';
import type { SEOData } from '@/components/builder/seo-panel';
import type { SetupSettings } from '@/components/builder/setup-panel';
import type { StoreSettings } from '@/components/builder/store-settings-panel';
import { apiPost } from '@/lib/api-client';
import type { BuilderMutationResponse } from '@/types/builder';
import type { BuilderToast } from './builder-client-types';
import { getBuilderMutationErrorMessage } from './builder-descriptions';

interface SaveBuilderDraftParams {
  merchantId: string;
  isCurrentRequest: () => boolean;
  newData: Data;
  seoData: SEOData;
  storeSettings: StoreSettings;
  setupSettings: SetupSettings;
  expectedLastUpdated: string | null;
  setLastUpdated: Dispatch<SetStateAction<string | null>>;
  setSaving: Dispatch<SetStateAction<boolean>>;
  toast: BuilderToast;
}

export async function saveBuilderDraft(
  params: SaveBuilderDraftParams
): Promise<string | null> {
  const {
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
  } = params;

  setSaving(true);
  try {
    const result = await apiPost<BuilderMutationResponse>('/api/builder', {
      merchantId,
      slug: 'home',
      name: 'Home',
      config: newData,
      seo: seoData,
      storeSettings,
      setupSettings,
      expectedLastUpdated,
    });
    if (!isCurrentRequest()) {
      return null;
    }
    setLastUpdated(result.lastUpdated);
    return result.lastUpdated;
  } catch (error) {
    if (!isCurrentRequest()) {
      return null;
    }
    console.error('Failed to save:', error);
    toast({
      title: 'Error',
      description: getBuilderMutationErrorMessage(
        error,
        'Failed to save changes.'
      ),
      variant: 'destructive',
    });
    return null;
  } finally {
    if (isCurrentRequest()) {
      setSaving(false);
    }
  }
}
