/**
 * JumiaChannelCard — Jumia marketplace connection card with OAuth flow.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { JUMIA_CONNECTION_STATUS } from '@/constants/marketplace';
import { useMerchant } from '@/hooks/useMerchant';
import { apiClient } from '@/lib/api-client';
import { jumiaChannelCardStyles as styles } from './JumiaChannelCard.styles';
import {
  connectJumiaFlow,
  disconnectJumiaFlow,
  type JumiaIntegration,
  reportJumiaError,
} from './jumia-channel-flows';

interface JumiaChannelCardProps {
  colors: Record<string, string>;
  shadows: Record<string, object>;
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
