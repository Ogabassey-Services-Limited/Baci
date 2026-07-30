import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
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
import { formatAiCopilotError } from './format-ai-copilot-error';
import { useMerchant } from './useMerchant';

export type { BuilderConfig } from './builder-ai-request';

export function useBuilderConfig(pageSlug: string = 'home') {
  const queryClient = useQueryClient();
  const { session, isLoading } = useAuth();
  const { merchant } = useMerchant();
  const merchantId = merchant?.id ?? null;
  const merchantIdRef = useRef(merchantId);
  merchantIdRef.current = merchantId;
  const aiRequestSequenceRef = useRef(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentConfig, setCurrentConfig] =
    useState<MerchantBuilderDraft | null>(null);
  const [activeAiRequestSequence, setActiveAiRequestSequence] = useState<
    number | null
  >(null);

  useEffect(() => {
    aiRequestSequenceRef.current += 1;
    setActiveAiRequestSequence(null);
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

        // Add success message to chat
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content:
            "Done! I've updated your storefront. Check the preview to see the changes.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Update local config
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
        // Add error message to chat
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

  // Save draft
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
    onSuccess: (_data, variables) => {
      // Clear local override so query cache becomes source of truth again
      setCurrentConfig((draft) =>
        draft?.merchantId === variables.merchantId ? null : draft
      );
      queryClient.invalidateQueries({
        queryKey: ['builderConfig', variables.merchantId, pageSlug],
      });
    },
  });

  // Publish
  const publishMutation = useMutation({
    mutationFn: async (variables: BuilderMutationVariables): Promise<void> => {
      if (!variables.merchantId) {
        throw new Error('Merchant not loaded. Please try again.');
      }

      // First save the current config as draft
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
  });

  // Send a message to the AI
  function sendMessage(prompt: string) {
    return aiMutation.mutateAsync(prompt);
  }

  // Clear chat history
  function clearChat() {
    setMessages([]);
  }

  return {
    // Config state
    config: effectiveConfig,
    configData,
    isLoadingConfig,
    configError,
    refetchConfig,

    // Chat state
    messages,
    clearChat,

    // AI actions
    sendMessage,
    isProcessingAI: activeAiRequestSequence !== null,
    aiError: aiMutation.error,

    // Save/Publish actions
    saveDraft: (
      _variables?: undefined,
      options?: Parameters<typeof saveDraftMutation.mutate>[1]
    ) =>
      saveDraftMutation.mutate({ merchantId: merchant?.id ?? null }, options),
    isSavingDraft: saveDraftMutation.isPending,
    saveDraftError: saveDraftMutation.error,

    publish: (
      _variables?: undefined,
      options?: Parameters<typeof publishMutation.mutate>[1]
    ) => publishMutation.mutate({ merchantId: merchant?.id ?? null }, options),
    isPublishing: publishMutation.isPending,
    publishError: publishMutation.error,

    // Convenience
    hasUnsavedChanges:
      currentConfig?.merchantId === merchantId &&
      JSON.stringify(effectiveConfig) !== JSON.stringify(configData?.config),
    isPublished: configData?.isPublished ?? false,
  };
}
