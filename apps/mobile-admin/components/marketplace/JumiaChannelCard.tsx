/**
 * JumiaChannelCard — Jumia marketplace connection card with OAuth flow.
 */

import { JUMIA_MOBILE_RETURN_URL } from '@baci/shared';
import {
  type QueryClient,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { JUMIA_CONNECTION_STATUS } from '@/constants/marketplace';
import { useMerchant } from '@/hooks/useMerchant';
import { apiClient } from '@/lib/api-client';
import { jumiaChannelCardStyles as styles } from './JumiaChannelCard.styles';

interface JumiaChannelCardProps {
  colors: Record<string, string>;
  shadows: Record<string, object>;
}

interface JumiaIntegration {
  id: string;
}

function getSafeJumiaErrorLog(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  return { name: typeof error };
}

function reportJumiaError(context: string, fallbackMessage: string) {
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

// Module-scope so try/finally and throw-in-try stay outside the component
// body (React Compiler cannot lower those statements yet).
async function connectJumiaFlow({ merchantId, queryClient }: JumiaFlowContext) {
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

async function disconnectJumiaFlow({
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

export function JumiaChannelCard({ colors, shadows }: JumiaChannelCardProps) {
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;
  const queryClient = useQueryClient();

  const {
    data: connectionData,
    isLoading,
    isFetching,
    isError: statusError,
  } = useQuery({
    queryKey: [JUMIA_CONNECTION_STATUS, merchantId],
    queryFn: ({ signal }) =>
      apiClient<{ integrations?: JumiaIntegration[] }>(
        '/api/marketplace/jumia/connect',
        { signal }
      ),
    staleTime: 5 * 60 * 1000,
    retry: 2,
    enabled: !!merchantId,
  });

  const statusLoading = isLoading || isFetching;
  const connectedIntegrations = connectionData?.integrations ?? [];
  const isConnected = connectedIntegrations.length > 0;
  const [loading, setLoading] = useState(false);

  const handleConnect = () => {
    setLoading(true);
    void connectJumiaFlow({ merchantId, queryClient })
      .catch(
        reportJumiaError('connect failed', 'Failed to connect Jumia account')
      )
      .finally(() => setLoading(false));
  };

  const disconnectJumia = () => {
    if (connectedIntegrations.length === 0) return;

    setLoading(true);
    void disconnectJumiaFlow({ connectedIntegrations, merchantId, queryClient })
      .catch(
        reportJumiaError(
          'disconnect failed',
          'Failed to disconnect Jumia account'
        )
      )
      .finally(() => setLoading(false));
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Jumia Account?',
      'Order and product sync from Jumia will stop until you reconnect.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            disconnectJumia();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
      <View style={styles.channelHeader}>
        <View
          style={[styles.iconContainer, { backgroundColor: colors.orange }]}
        >
          <Text style={[styles.iconText, { color: colors.textOnPrimary }]}>
            J
          </Text>
        </View>
        <View style={styles.channelInfo}>
          <Text style={[styles.channelTitle, { color: colors.text }]}>
            Jumia
          </Text>
          <Text style={[styles.channelDesc, { color: colors.textSecondary }]}>
            Africa's no.1 marketplace
          </Text>
        </View>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: isConnected
                ? colors.successLight
                : colors.border,
            },
          ]}
        >
          {statusLoading ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            <Text
              style={[
                styles.badgeText,
                {
                  color: statusError
                    ? colors.warning
                    : isConnected
                      ? colors.success
                      : colors.textMuted,
                },
              ]}
            >
              {statusError
                ? 'Unavailable'
                : isConnected
                  ? 'Active'
                  : 'Inactive'}
            </Text>
          )}
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <Pressable
        onPress={isConnected ? handleDisconnect : handleConnect}
        disabled={loading || statusLoading}
        style={[
          styles.connectButton,
          {
            backgroundColor: isConnected
              ? colors.errorLight || colors.cardHover
              : colors.primary,
            opacity: loading || statusLoading ? 0.7 : 1,
          },
        ]}
      >
        {loading || statusLoading ? (
          <ActivityIndicator
            color={statusLoading ? colors.textMuted : colors.textOnPrimary}
          />
        ) : (
          <Text
            style={[
              styles.connectButtonText,
              { color: isConnected ? colors.error : colors.textOnPrimary },
            ]}
          >
            {isConnected ? 'Disconnect Jumia Account' : 'Connect Jumia Account'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
