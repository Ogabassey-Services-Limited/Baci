import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { invalidateStoreReadiness } from '@/lib/invalidate-store-readiness';
import { tryRefreshStoreReadiness } from '@/lib/try-refresh-store-readiness';
import {
  type BuilderApiResponse,
  type BuilderConfig,
  type BuilderMutationVariables,
  type ChatMessage,
  type GeminiResponse,
  isCurrentBuilderAiRequest,
  type MerchantBuilderDraft,
} from './builder-ai-request';
import type { BuilderMerchantRequest } from './builder-mutation-callbacks';
import { createBuilderMerchantMutationAction } from './createBuilderMerchantMutationAction';
import { formatAiCopilotError } from './format-ai-copilot-error';
import { useMerchant } from './useMerchant';
import { useMerchantScopedPending } from './useMerchantScopedPending';

export type { BuilderConfig } from './builder-ai-request';
export function useBuilderConfig(pageSlug: string = 'home') {
  const queryClient = useQueryClient();
  const { session, isLoading } = useAuth();
  const { merchant } = useMerchant();
  const merchantId = merchant?.id ?? null;
  const savePending = useMerchantScopedPending();
  const publishPending = useMerchantScopedPending();
  const merchantRequestRef = useRef<BuilderMerchantRequest>({
    merchantId,
    revision: 0,
  });
  const aiRequestSequenceRef = useRef(0);
  const messagesMerchantIdRef = useRef(merchantId);
  const errorMerchantIdRef = useRef(merchantId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentConfig, setCurrentConfig] =
    useState<MerchantBuilderDraft | null>(null);
  const [activeAiRequestSequence, setActiveAiRequestSequence] = useState<
    number | null
  >(null);

  useLayoutEffect(() => {
    if (merchantRequestRef.current.merchantId !== merchantId) {
      merchantRequestRef.current = {
        merchantId,
        revision: merchantRequestRef.current.revision + 1,
      };
    }
    // A completion from the prior committed merchant must never become active
    // if the user returns to that merchant later.
    aiRequestSequenceRef.current += 1;
  }, [merchantId]);

  useEffect(() => {
    setActiveAiRequestSequence(null);
    messagesMerchantIdRef.current = merchantId;
    setMessages([]);
    setCurrentConfig((draft) =>
      draft?.merchantId === merchantId ? draft : null
    );
  }, [merchantId]);
  const {
    data: configData,
    isLoading: isLoadingConfig,
    error: configError,
    refetch: refetchConfig,
  } = useQuery({
    queryKey: ['builderConfig', merchantId, pageSlug],
    enabled: !!session?.access_token && !isLoading && !!merchantId,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message === 'Not authenticated') {
        return false;
      }
      return failureCount < 3;
    },
    queryFn: (): Promise<BuilderApiResponse> => {
      const token = session?.access_token;
      if (!token) {
        throw new Error('Not authenticated');
      }
      if (!merchantId) {
        throw new Error('Merchant not loaded. Please try again.');
      }
      return apiClient<BuilderApiResponse>(
        `/api/builder?slug=${encodeURIComponent(pageSlug)}&merchantId=${encodeURIComponent(merchantId)}`
      );
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  const effectiveConfig =
    currentConfig?.merchantId === merchantId
      ? currentConfig.config
      : (configData?.config ?? null);
  const aiMutation = useMutation({
    mutationFn: async (prompt: string): Promise<BuilderConfig> => {
      const token = session?.access_token;
      if (!token) {
        throw new Error('Not authenticated');
      }
      if (!effectiveConfig) {
        throw new Error('No configuration loaded');
      }
      if (!merchantId) {
        throw new Error('Merchant not loaded. Please try again.');
      }
      const requestMerchantId = merchantId;
      const requestConfig = effectiveConfig;
      const requestSequence = ++aiRequestSequenceRef.current;
      setActiveAiRequestSequence(requestSequence);
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: prompt,
        timestamp: new Date(),
      };
      messagesMerchantIdRef.current = requestMerchantId;
      setMessages((prev) => [...prev, userMessage]);
      try {
        const data = await apiClient<GeminiResponse>('/api/builder/gemini', {
          method: 'POST',
          timeout: 30_000,
          body: JSON.stringify({
            merchantId: requestMerchantId,
            prompt,
            currentConfig: requestConfig,
          }),
        });
        if (!isCurrentBuilderAiRequest(aiRequestSequenceRef, requestSequence)) {
          return data.config;
        }
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content:
            "Done! I've updated your storefront. Check the preview to see the changes.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setCurrentConfig({
          merchantId: requestMerchantId,
          config: data.config,
        });
        return data.config;
      } catch (error) {
        if (!isCurrentBuilderAiRequest(aiRequestSequenceRef, requestSequence)) {
          return requestConfig;
        }
        const formattedError = formatAiCopilotError(error);
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'system',
          content: formattedError.message,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        throw Object.assign(new Error(formattedError.message), {
          code: formattedError.code,
          requestId: formattedError.requestId,
        });
      } finally {
        if (isCurrentBuilderAiRequest(aiRequestSequenceRef, requestSequence)) {
          setActiveAiRequestSequence(null);
        }
      }
    },
  });
  const saveDraftMutation = useMutation({
    mutationFn: async ({
      merchantId,
    }: BuilderMutationVariables): Promise<void> => {
      const token = session?.access_token;
      if (!token) {
        throw new Error('Not authenticated');
      }
      if (!merchantId) {
        throw new Error('Merchant not loaded. Please try again.');
      }
      if (!effectiveConfig) {
        throw new Error('No configuration to save');
      }
      await apiClient('/api/builder', {
        method: 'POST',
        body: JSON.stringify({
          slug: pageSlug,
          merchantId,
          config: effectiveConfig,
          name: 'Home',
        }),
      });
    },
    onMutate: (variables) => {
      savePending.begin(variables.merchantId);
    },
    onSuccess: (_data, variables) => {
      setCurrentConfig((draft) =>
        draft?.merchantId === variables.merchantId ? null : draft
      );
      queryClient.invalidateQueries({
        queryKey: ['builderConfig', variables.merchantId, pageSlug],
      });
    },
    onSettled: (_data, _error, variables) => {
      savePending.end(variables.merchantId);
    },
  });
  const publishMutation = useMutation({
    mutationFn: async (variables: BuilderMutationVariables): Promise<void> => {
      if (!variables.merchantId) {
        throw new Error('Merchant not loaded. Please try again.');
      }
      await saveDraftMutation.mutateAsync(variables);
      const token = session?.access_token;
      if (!token) {
        throw new Error('Not authenticated');
      }
      await apiClient('/api/builder', {
        method: 'PUT',
        body: JSON.stringify({
          slug: pageSlug,
          merchantId: variables.merchantId,
        }),
      });
    },
    onMutate: (variables) => {
      publishPending.begin(variables.merchantId);
    },
    onSuccess: async (_data, variables) => {
      const invalidations: Promise<unknown>[] = [
        queryClient.invalidateQueries({
          queryKey: ['builderConfig', variables.merchantId, pageSlug],
        }),
      ];
      const merchantId = variables.merchantId;
      if (merchantId) {
        invalidations.push(
          tryRefreshStoreReadiness(() =>
            invalidateStoreReadiness(queryClient, merchantId)
          )
        );
      }
      await Promise.all(invalidations);
    },
    onSettled: (_data, _error, variables) => {
      publishPending.end(variables.merchantId);
    },
  });
  useLayoutEffect(() => {
    if (errorMerchantIdRef.current === merchantId) return;
    errorMerchantIdRef.current = merchantId;
    aiMutation.reset();
    saveDraftMutation.reset();
    publishMutation.reset();
  }, [
    merchantId,
    aiMutation.reset,
    publishMutation.reset,
    saveDraftMutation.reset,
  ]);
  function sendMessage(prompt: string) {
    return aiMutation.mutateAsync(prompt);
  }
  function clearChat() {
    setMessages([]);
  }
  return {
    config: effectiveConfig,
    configData,
    isLoadingConfig,
    configError,
    refetchConfig,
    messages: messagesMerchantIdRef.current === merchantId ? messages : [],
    clearChat,
    sendMessage,
    isProcessingAI: activeAiRequestSequence !== null,
    aiError: aiMutation.error,
    saveDraft: createBuilderMerchantMutationAction(
      saveDraftMutation,
      merchantRequestRef
    ),
    isSavingDraft: savePending.isPending(merchantId),
    saveDraftError: saveDraftMutation.error,
    publish: createBuilderMerchantMutationAction(
      publishMutation,
      merchantRequestRef
    ),
    isPublishing: publishPending.isPending(merchantId),
    publishError: publishMutation.error,
    hasUnsavedChanges:
      currentConfig?.merchantId === merchantId &&
      JSON.stringify(effectiveConfig) !== JSON.stringify(configData?.config),
    isPublished: configData?.isPublished ?? false,
  };
}
