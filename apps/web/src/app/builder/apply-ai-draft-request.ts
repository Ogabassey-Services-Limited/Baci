import type { Dispatch, SetStateAction } from 'react';
import { fetchWithCsrf } from '@/lib/api-client';
import type {
  BuilderRouter,
  BuilderSessionSetters,
  BuilderToast,
} from './builder-client-types';
import { getBuilderMutationErrorMessage } from './builder-descriptions';

interface ApplyAiDraftRequestParams extends BuilderSessionSetters {
  aiDraftJobId: string;
  force: boolean;
  merchantId: string;
  isCurrentRequest: () => boolean;
  router: BuilderRouter;
  toast: BuilderToast;
  setShowStaleAiDraftDialog: Dispatch<SetStateAction<boolean>>;
  setApplyingAiDraft: Dispatch<SetStateAction<boolean>>;
}

async function readApplyAiDraftResponse(response: Response) {
  try {
    return (await response.json()) as {
      error?: string;
      code?: string;
      message?: string;
      lastUpdated?: string | null;
    };
  } catch {
    return {};
  }
}

export async function applyAiDraftRequest(params: ApplyAiDraftRequestParams) {
  const {
    aiDraftJobId,
    force,
    merchantId,
    isCurrentRequest,
    router,
    toast,
    setShowStaleAiDraftDialog,
    setApplyingAiDraft,
    setLastUpdated,
    setCanEdit,
    setDegradedReason,
    setPreviewMode,
    setAiDraftJobId,
    setCanApplyAiDraft,
  } = params;

  if (!isCurrentRequest()) return;
  setApplyingAiDraft(true);
  try {
    const response = await fetchWithCsrf(`/api/ai-jobs/${aiDraftJobId}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId, ...(force ? { force } : {}) }),
    });
    if (!isCurrentRequest()) return;
    const payload = await readApplyAiDraftResponse(response);
    if (!isCurrentRequest()) return;

    if (
      !force &&
      response.status === 409 &&
      payload.code === 'ai_draft_stale'
    ) {
      setShowStaleAiDraftDialog(true);
      return;
    }

    if (!response.ok) {
      throw new Error(
        payload.error || payload.message || 'Failed to apply AI design'
      );
    }

    setLastUpdated(payload.lastUpdated ?? null);
    toast({
      title: 'AI design applied',
      description: 'The generated storefront is now your editable draft.',
    });
    setCanEdit(true);
    setDegradedReason(null);
    setPreviewMode(null);
    setAiDraftJobId(null);
    setCanApplyAiDraft(false);
    router.push('/builder');
  } catch (error) {
    if (!isCurrentRequest()) return;
    console.error('Failed to apply AI draft:', error);
    toast({
      title: 'Failed to apply AI design',
      description: getBuilderMutationErrorMessage(
        error,
        'Please retry from the dashboard.'
      ),
      variant: 'destructive',
    });
  } finally {
    if (isCurrentRequest()) {
      setApplyingAiDraft(false);
    }
  }
}
