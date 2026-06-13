import type { Data } from '@puckeditor/core';
import type { useRouter } from 'next/navigation';
import type { Dispatch, SetStateAction } from 'react';
import type { SEOData } from '@/components/builder/seo-panel';
import type { SetupSettings } from '@/components/builder/setup-panel';
import type { StoreSettings } from '@/components/builder/store-settings-panel';
import type { useToast } from '@/hooks/use-toast';
import type { BuilderDegradedReason } from '@/schemas/builder';
import type { BuilderLoadResponse } from '@/types/builder';

export type BuilderPreviewMode = BuilderLoadResponse['previewMode'];
export type BuilderRouter = ReturnType<typeof useRouter>;
export type BuilderToast = ReturnType<typeof useToast>['toast'];

export interface BuilderSessionSetters {
  setLastUpdated: Dispatch<SetStateAction<string | null>>;
  setCanEdit: Dispatch<SetStateAction<boolean>>;
  setDegradedReason: Dispatch<SetStateAction<BuilderDegradedReason | null>>;
  setPreviewMode: Dispatch<SetStateAction<BuilderPreviewMode>>;
  setAiDraftJobId: Dispatch<SetStateAction<string | null>>;
  setCanApplyAiDraft: Dispatch<SetStateAction<boolean>>;
}

export interface BuilderDataSetters {
  setData: Dispatch<SetStateAction<Data>>;
  setSeoData: Dispatch<SetStateAction<SEOData>>;
  setStoreSettings: Dispatch<SetStateAction<StoreSettings>>;
  setSetupSettings: Dispatch<SetStateAction<SetupSettings>>;
}
