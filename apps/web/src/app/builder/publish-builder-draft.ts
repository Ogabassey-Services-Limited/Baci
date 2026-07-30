import type { Dispatch, SetStateAction } from 'react';
import { apiPut } from '@/lib/api-client';
import type { BuilderMutationResponse } from '@/types/builder';
import type { BuilderToast } from './builder-client-types';
import { getBuilderMutationErrorMessage } from './builder-descriptions';

interface PublishBuilderDraftParams {
  merchantId: string;
  expectedLastUpdated: string;
  setLastUpdated: Dispatch<SetStateAction<string | null>>;
  setPublishing: Dispatch<SetStateAction<boolean>>;
  toast: BuilderToast;
}

export async function publishBuilderDraft(params: PublishBuilderDraftParams) {
  const {
    merchantId,
    expectedLastUpdated,
    setLastUpdated,
    setPublishing,
    toast,
  } = params;

  try {
    const result = await apiPut<BuilderMutationResponse>('/api/builder', {
      merchantId,
      slug: 'home',
      expectedLastUpdated,
    });
    setLastUpdated(result.lastUpdated);

    toast({
      title: 'Published! 🚀',
      description: 'Your changes are now live on your storefront.',
    });
  } catch (error) {
    console.error('Failed to publish:', error);
    toast({
      title: 'Error',
      description: getBuilderMutationErrorMessage(
        error,
        'Failed to publish changes.'
      ),
      variant: 'destructive',
    });
  } finally {
    setPublishing(false);
  }
}
