/**
 * JumiaChannelCard — Jumia marketplace connection card with OAuth flow.
 */

import { JUMIA_MOBILE_RETURN_URL } from '@baci/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useMerchant } from '@/hooks/useMerchant';
import { apiClient } from '@/lib/api-client';

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
    queryKey: ['jumia-connection-status', merchantId],
    queryFn: ({ signal }) =>
      apiClient<{ integrations?: Array<{ id: string }> }>(
        '/api/marketplace/jumia/connect',
        { signal }
      ),
    staleTime: 5 * 60 * 1000,
    retry: 2,
    enabled: !!merchantId,
  });

  const statusLoading = isLoading || isFetching;
  const isConnected = (connectionData?.integrations?.length ?? 0) > 0;
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
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
        redirectUrl
      );

      if (result.type === 'success' && result.url) {
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
              queryKey: ['jumia-connection-status', merchantId],
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
    } catch (error) {
      console.error('Jumia connect error:', error);
      Alert.alert('Error', 'Failed to connect Jumia account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
      <View style={styles.channelHeader}>
        <View style={[styles.iconContainer, { backgroundColor: '#FF9900' }]}>
          <Text style={styles.iconText}>J</Text>
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
        onPress={handleConnect}
        disabled={loading || isConnected || statusLoading}
        style={[
          styles.connectButton,
          {
            backgroundColor: isConnected ? colors.cardHover : colors.primary,
            opacity: loading || statusLoading ? 0.7 : 1,
          },
        ]}
      >
        {loading || statusLoading ? (
          <ActivityIndicator
            color={statusLoading ? colors.textMuted : '#FFF'}
          />
        ) : (
          <Text
            style={[
              styles.connectButtonText,
              { color: isConnected ? colors.textSecondary : '#FFF' },
            ]}
          >
            {isConnected ? 'Connected to Jumia' : 'Connect Jumia Account'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  channelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  iconText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  channelInfo: { flex: 1 },
  channelTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  channelDesc: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    marginVertical: SPACING.lg,
  },
  connectButton: {
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectButtonText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
