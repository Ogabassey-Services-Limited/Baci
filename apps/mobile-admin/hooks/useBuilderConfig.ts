/**
 * useBuilderConfig Hook
 * Manages the page builder configuration for the AI Copilot.
 * Communicates with the Web API to fetch, modify via AI, save, and publish configs.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Web API base URL - uses the same Supabase project
const WEB_API_BASE =
  process.env.EXPO_PUBLIC_WEB_API_URL || 'https://usebaci.com';

export interface BuilderConfig {
  content: Array<{
    type: string;
    props: Record<string, unknown>;
  }>;
  root: {
    title?: string;
    [key: string]: unknown;
  };
  zones?: Record<string, unknown>;
  theme?: {
    colors?: {
      primary?: string;
      accent?: string;
      header?: Record<string, string>;
      footer?: Record<string, string>;
    };
    [key: string]: unknown;
  };
}

interface BuilderApiResponse {
  config: BuilderConfig;
  seo?: Record<string, unknown>;
  storeSettings?: Record<string, unknown>;
  setupSettings?: Record<string, unknown>;
  publishedConfig?: BuilderConfig | null;
  isPublished?: boolean;
  isDefault?: boolean;
  lastUpdated?: string;
}

interface GeminiResponse {
  config: BuilderConfig;
  error?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

/**
 * Helper to get auth token for API calls
 */
async function getAuthToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || null;
}

export function useBuilderConfig(pageSlug: string = 'home') {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentConfig, setCurrentConfig] = useState<BuilderConfig | null>(
    null
  );

  // Fetch current configuration
  const {
    data: configData,
    isLoading: isLoadingConfig,
    error: configError,
    refetch: refetchConfig,
  } = useQuery({
    queryKey: ['builderConfig', pageSlug],
    queryFn: async (): Promise<BuilderApiResponse> => {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${WEB_API_BASE}/api/builder?slug=${pageSlug}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to fetch config: ${response.status}`
        );
      }

      const data = await response.json();
      setCurrentConfig(data.config);
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Update config with AI (Gemini)
  const aiMutation = useMutation({
    mutationFn: async (prompt: string): Promise<BuilderConfig> => {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      if (!currentConfig) {
        throw new Error('No configuration loaded');
      }

      // Add user message to chat
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: prompt,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      const response = await fetch(`${WEB_API_BASE}/api/builder/gemini`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          currentConfig,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Add error message to chat
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'system',
          content: errorData.error || 'Failed to process request',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);

        throw new Error(
          errorData.error || `AI request failed: ${response.status}`
        );
      }

      const data: GeminiResponse = await response.json();

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
      setCurrentConfig(data.config);

      return data.config;
    },
  });

  // Save draft
  const saveDraftMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      if (!currentConfig) {
        throw new Error('No configuration to save');
      }

      const response = await fetch(`${WEB_API_BASE}/api/builder`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slug: pageSlug,
          config: currentConfig,
          name: 'Home',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save draft');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['builderConfig', pageSlug] });
    },
  });

  // Publish
  const publishMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      // First save the current config as draft
      await saveDraftMutation.mutateAsync();

      const token = await getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${WEB_API_BASE}/api/builder`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slug: pageSlug,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to publish');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['builderConfig', pageSlug] });
    },
  });

  // Send a message to the AI
  const sendMessage = useCallback(
    async (prompt: string) => {
      return aiMutation.mutateAsync(prompt);
    },
    [aiMutation]
  );

  // Clear chat history
  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    // Config state
    config: currentConfig,
    configData,
    isLoadingConfig,
    configError,
    refetchConfig,

    // Chat state
    messages,
    clearChat,

    // AI actions
    sendMessage,
    isProcessingAI: aiMutation.isPending,
    aiError: aiMutation.error,

    // Save/Publish actions
    saveDraft: saveDraftMutation.mutate,
    isSavingDraft: saveDraftMutation.isPending,
    saveDraftError: saveDraftMutation.error,

    publish: publishMutation.mutate,
    isPublishing: publishMutation.isPending,
    publishError: publishMutation.error,

    // Convenience
    hasUnsavedChanges:
      !!currentConfig &&
      JSON.stringify(currentConfig) !== JSON.stringify(configData?.config),
    isPublished: configData?.isPublished ?? false,
  };
}
