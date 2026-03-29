/**
 * Marketplaces Screen
 * Manage external marketplace connections like Jumia, Konga, etc.
 */

import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { apiClient } from '@/lib/api-client';

export default function SalesChannelsScreen() {
  const { colors, shadows, isDark } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    data: connectionData,
    isLoading: statusLoading,
    isError: statusError,
  } = useQuery({
    queryKey: ['jumia-connection-status'],
    queryFn: ({ signal }) =>
      apiClient<{ integrations?: Array<{ id: string }> }>(
        '/api/marketplace/jumia/connect',
        { signal }
      ),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const isConnected = (connectionData?.integrations?.length ?? 0) > 0;
  const [loading, setLoading] = useState(false);

  const handleConnectJumia = async () => {
    setLoading(true);
    try {
      // Step 1: Get a short-lived ticket via authenticated API call
      const ticketData = await apiClient<{ ticket: string; authUrl: string }>(
        '/api/marketplace/jumia/connect/ticket',
        { method: 'POST' }
      );

      if (!ticketData.authUrl) {
        Alert.alert('Error', 'Failed to create connection ticket');
        return;
      }

      // Step 2: Open browser → Jumia login → callback → deep link with code
      const result = await WebBrowser.openAuthSessionAsync(
        ticketData.authUrl,
        'baciadmin://'
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
          // Step 3: Exchange code via authenticated endpoint (bound to ticket)
          const exchangeData = await apiClient<{
            success: boolean;
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
              queryKey: ['jumia-connection-status'],
            });
            Alert.alert('Success', 'Jumia account connected successfully!');
          } else {
            Alert.alert(
              'Error',
              exchangeData.error || 'Failed to complete connection'
            );
          }
        } else if (queryParams?.code || queryParams?.ticketId) {
          // Partial deep link — code or ticket missing (e.g. interrupted flow)
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
    <>
      <Stack.Screen
        options={{
          title: 'Marketplaces',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <SystemBars style={isDark ? 'light' : 'dark'} />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Connect your store to major marketplaces to sync inventory and
              orders automatically.
            </Text>
          </View>

          {/* Jumia Channel */}
          <View
            style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
          >
            <View style={styles.channelHeader}>
              <View
                style={[styles.iconContainer, { backgroundColor: '#FF9900' }]}
              >
                <Text style={styles.iconText}>J</Text>
              </View>
              <View style={styles.channelInfo}>
                <Text style={[styles.channelTitle, { color: colors.text }]}>
                  Jumia
                </Text>
                <Text
                  style={[styles.channelDesc, { color: colors.textSecondary }]}
                >
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

            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />

            <Pressable
              onPress={handleConnectJumia}
              disabled={loading || isConnected || statusLoading}
              style={[
                styles.connectButton,
                {
                  backgroundColor: isConnected
                    ? colors.cardHover
                    : colors.primary,
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

          {/* Pending Channels */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, opacity: 0.6 },
            ]}
          >
            <View style={styles.channelHeader}>
              <View
                style={[styles.iconContainer, { backgroundColor: '#3366FF' }]}
              >
                <Text style={styles.iconText}>K</Text>
              </View>
              <View style={styles.channelInfo}>
                <Text style={[styles.channelTitle, { color: colors.text }]}>
                  Konga
                </Text>
                <Text
                  style={[styles.channelDesc, { color: colors.textSecondary }]}
                >
                  Coming soon
                </Text>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, opacity: 0.6 },
            ]}
          >
            <View style={styles.channelHeader}>
              <View
                style={[styles.iconContainer, { backgroundColor: '#000000' }]}
              >
                <Ionicons name="logo-amazon" size={20} color="#FFF" />
              </View>
              <View style={styles.channelInfo}>
                <Text style={[styles.channelTitle, { color: colors.text }]}>
                  Amazon
                </Text>
                <Text
                  style={[styles.channelDesc, { color: colors.textSecondary }]}
                >
                  Coming soon
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: SPACING.lg },
  backButton: { padding: SPACING.sm, marginLeft: -SPACING.sm },
  header: { marginBottom: SPACING.xl },
  subtitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: 20,
  },
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
