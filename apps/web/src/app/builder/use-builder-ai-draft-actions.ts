import type { Data } from '@puckeditor/core';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { BuilderDegradedReason } from '@/schemas/builder';
import { applyAiDraftRequest } from './apply-ai-draft-request';
import type {
  BuilderPreviewMode,
  BuilderRouter,
  BuilderSessionSetters,
  BuilderToast,
} from './builder-client-types';
import { getReadOnlyBuilderDescription } from './builder-descriptions';
import { runBuilderAiCommand } from './run-builder-ai-command';

interface BuilderAiDraftActionsParams extends BuilderSessionSetters {
  aiDraftJobId: string | null;
  canApplyAiDraft: boolean;
  canEdit: boolean;
  data: Data;
  degradedReason: BuilderDegradedReason | null;
  merchantId: string | null;
  previewMode: BuilderPreviewMode;
  router: BuilderRouter;
  setApplyingAiDraft: Dispatch<SetStateAction<boolean>>;
  setData: Dispatch<SetStateAction<Data>>;
  setIsAiLoading: Dispatch<SetStateAction<boolean>>;
  setShowStaleAiDraftDialog: Dispatch<SetStateAction<boolean>>;
  toast: BuilderToast;
}

export function useBuilderAiDraftActions({
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
}: BuilderAiDraftActionsParams) {
  const merchantIdRef = useRef(merchantId);
  const requestMerchantIdRef = useRef(merchantId);
  const requestSequenceRef = useRef(0);
  const stateMerchantIdRef = useRef(merchantId);

  useLayoutEffect(() => {
    merchantIdRef.current = merchantId;
    if (requestMerchantIdRef.current !== merchantId) {
      requestMerchantIdRef.current = merchantId;
      requestSequenceRef.current += 1;
    }
  }, [merchantId]);

  useEffect(() => {
    if (stateMerchantIdRef.current === merchantId) return;
    stateMerchantIdRef.current = merchantId;
    setIsAiLoading(false);
    setApplyingAiDraft(false);
    setShowStaleAiDraftDialog(false);
  }, [
    merchantId,
    setApplyingAiDraft,
    setIsAiLoading,
    setShowStaleAiDraftDialog,
  ]);

  async function handleAiCommand(command: string) {
    if (!merchantId) {
      toast({
        title: 'No merchant selected',
        description: 'Select a merchant before using the AI builder.',
        variant: 'destructive',
      });
      return;
    }

    if (!canEdit) {
      toast({
        title: 'Builder is read-only',
        description: getReadOnlyBuilderDescription(previewMode, degradedReason),
        variant: 'destructive',
      });
      return;
    }

    const requestSequence = ++requestSequenceRef.current;
    await runBuilderAiCommand({
      merchantId,
      isCurrentRequest: () =>
        requestSequenceRef.current === requestSequence &&
        merchantIdRef.current === merchantId,
      command,
      currentConfig: data,
      setData,
      setIsAiLoading,
      toast,
    });
  }

  async function applyAiDraft(force = false) {
    const selectedMerchantId = merchantId;
    if (!selectedMerchantId) {
      toast({
        title: 'No merchant selected',
        description: 'Select a merchant before using the AI builder.',
        variant: 'destructive',
      });
      return;
    }

    if (!aiDraftJobId || !canApplyAiDraft) {
      toast({
        title: 'Cannot apply this draft',
        description:
          'You need builder edit access before this AI design can replace the starter draft.',
        variant: 'destructive',
      });
      return;
    }

    const requestSequence = ++requestSequenceRef.current;
    await applyAiDraftRequest({
      aiDraftJobId,
      force,
      merchantId: selectedMerchantId,
      isCurrentRequest: () =>
        requestSequenceRef.current === requestSequence &&
        merchantIdRef.current === selectedMerchantId,
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
    });
  }

  return { applyAiDraft, handleAiCommand };
}
