/**
 * Marketplaces Screen
 * Manage external marketplace connections like Jumia, Konga, etc.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JumiaChannelCard } from '@/components/marketplace/JumiaChannelCard';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export default function SalesChannelsScreen() {
  const { colors, shadows, isDark } = useTheme();
  const router = useRouter();

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

          <JumiaChannelCard colors={colors} shadows={shadows} />

          {/* Pending Channels */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, opacity: 0.6 },
            ]}
          >
            <View style={styles.channelHeader}>
              <View
                style={[styles.iconContainer, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.iconText, { color: colors.textOnPrimary }]}>K</Text>
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
                style={[styles.iconContainer, { backgroundColor: colors.text }]}
              >
                <Ionicons name="logo-amazon" size={20} color={colors.background} />
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
});
