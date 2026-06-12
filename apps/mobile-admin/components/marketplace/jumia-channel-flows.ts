/**
 * Jumia OAuth connect/disconnect flows for JumiaChannelCard.
 *
 * Module-scope so try/finally and throw-in-try stay outside the component
 * body (React Compiler cannot lower those statements yet).
 */

import { JUMIA_MOBILE_RETURN_URL } from '@baci/shared';
import type { QueryClient } from '@tanstack/react-query';
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Alert } from 'react-native';
import { JUMIA_CONNECTION_STATUS } from '@/constants/marketplace';
import { apiClient } from '@/lib/api-client';

export interface JumiaIntegration {
  id: string;
}

function getSafeJumiaErrorLog(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  return { name: typeof error };
}

export function reportJumiaError(context: string, fallbackMessage: string) {
  return (error: unknown) => {
    console.error(`[JumiaChannelCard] ${context}`, getSafeJumiaErrorLog(error));
    Alert.alert(
      'Error',
      error instanceof Error ? error.message : fallbackMessage
    );
  };
}

interface JumiaFlowContext {
  merchantId: string | undefined;
  queryClient: QueryClient;
}

export async function connectJumiaFlow({
  merchantId,
  queryClient,
}: JumiaFlowContext) {
  const ticketData = await apiClient<{ ticket: string; authUrl: string }>(
    '/api/marketplace/jumia/connect/ticket',
    { method: 'POST' }
  );
  if (!ticketData.authUrl) {
    Alert.alert('Error', 'Failed to create connection ticket');
    return;
  }

  const redirectUrl = makeRedirectUri({
    native: JUMIA_MOBILE_RETURN_URL,
  });

  const result = await WebBrowser.openAuthSessionAsync(
    ticketData.authUrl,
    redirectUrl,
    { preferEphemeralSession: true }
  );

  if (result.type !== 'success' || !result.url) return;

  const { queryParams } = Linking.parse(result.url);

  if (queryParams?.error) {
    Alert.alert(
      'Connection Error',
      String(queryParams.error).replace(/_/g, ' ')
    );
    return;
  }

  if (queryParams?.code && queryParams?.ticketId) {
    const exchangeData = await apiClient<{
      success: boolean;
      incomplete?: boolean;
      message?: string;
      shops?: string[];
      error?: string;
    }>('/api/marketplace/jumia/connect/exchange', {
      method: 'POST',
      body: JSON.stringify({
        code: queryParams.code,
        ticketId: queryParams.ticketId,
      }),
    });

    if (exchangeData.success) {
      void queryClient.invalidateQueries({
        queryKey: [JUMIA_CONNECTION_STATUS, merchantId],
      });
      Alert.alert('Success', 'Jumia account connected successfully!');
    } else {
      Alert.alert(
        exchangeData.incomplete ? 'Connection Incomplete' : 'Error',
        exchangeData.message ||
          exchangeData.error ||
          'Failed to complete connection'
      );
    }
  } else if (queryParams?.code || queryParams?.ticketId) {
    Alert.alert(
      'Connection Incomplete',
      'The Jumia authorization flow was interrupted. Please try again.'
    );
  }
}

export async function disconnectJumiaFlow({
  connectedIntegrations,
  merchantId,
  queryClient,
}: JumiaFlowContext & { connectedIntegrations: JumiaIntegration[] }) {
  const results = await Promise.allSettled(
    connectedIntegrations.map((integration) =>
      apiClient(
        `/api/marketplace/jumia/connect?id=${encodeURIComponent(
          integration.id
        )}`,
        { method: 'DELETE' }
      )
    )
  );

  void queryClient.invalidateQueries({
    queryKey: [JUMIA_CONNECTION_STATUS, merchantId],
  });

  const failedResults = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );
  if (failedResults.length > 0) {
    if (failedResults.length > 1) {
      console.error(
        '[JumiaChannelCard] disconnect failures',
        failedResults.map((result) => getSafeJumiaErrorLog(result.reason))
      );
    }
    throw failedResults[0].reason;
  }

  Alert.alert('Disconnected', 'Jumia account disconnected');
}
