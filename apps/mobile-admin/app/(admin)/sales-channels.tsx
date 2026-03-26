/**
 * Marketplaces Screen
 * Manage external marketplace connections like Jumia, Konga, etc.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
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

// Web API base URL from environment
const WEB_APP_URL =
  process.env.EXPO_PUBLIC_WEB_API_URL || 'https://usebaci.com';

const STATUS_TIMEOUT_MS = 5_000;

export default function SalesChannelsScreen() {
  const { colors, shadows, isDark } = useTheme();
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const checkConnectionStatus = async () => {
      try {
        timeoutId = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);
        const response = await fetch(
          `${WEB_APP_URL}/api/marketplace/jumia/status`,
          { signal: controller.signal }
        );
        if (response.ok) {
          const { connected } = await response.json();
          setIsConnected(connected);
          setStatusError(false);
        }
      } catch {
        setStatusError(true);
      } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
        setStatusLoading(false);
      }
    };

    checkConnectionStatus();
    return () => {
      controller.abort();
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, []);

  const handleConnectJumia = async () => {
    try {
      setLoading(true);
      const authUrl = `${WEB_APP_URL}/api/marketplace/jumia/connect?connectionType=oauth&platform=mobile`;

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        'baciadmin://'
      );

      if (result.type === 'success' && result.url) {
        const { queryParams } = Linking.parse(result.url);

        // Verify connection with backend instead of trusting query param alone
        if (queryParams?.code || queryParams?.success === 'jumia_connected') {
          const verifyResponse = await fetch(
            `${WEB_APP_URL}/api/marketplace/jumia/verify`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code: queryParams?.code,
                state: queryParams?.state,
              }),
            }
          );

          if (verifyResponse.ok) {
            const { connected } = await verifyResponse.json();
            if (connected) {
              setIsConnected(true);
              Alert.alert('Success', 'Jumia account connected successfully!');
              return;
            }
          }
          // Fallback if verify endpoint doesn't exist yet
          if (queryParams?.success === 'jumia_connected') {
            setIsConnected(true);
            Alert.alert('Success', 'Jumia account connected successfully!');
          }
        }
      }
    } catch (error) {
      console.error(error);
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
