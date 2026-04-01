/**
 * Discounts Screen
 * Manage coupons and promotions
 */

import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenSkeleton } from '@/components/ui/ScreenSkeleton';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useDiscounts } from '@/hooks/useDiscounts';
import { useTheme } from '@/hooks/useTheme';
import type { DiscountCode } from '@/lib/types/discounts';
import { formatCurrency } from '@/utils/format';

export default function DiscountsScreen() {
  const { colors, shadows, isDark } = useTheme();
  const router = useRouter();
  const { discounts, isLoading, deleteDiscount, isDeleting } = useDiscounts();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreateDiscount = () => {
    router.push('/discounts/new');
  };

  const handleDelete = (id: string, code: string) => {
    if (isDeleting) return; // Prevent double-submit
    Alert.alert(
      'Delete Discount',
      `Are you sure you want to delete "${code}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(id);
            try {
              await deleteDiscount(id);
            } catch (error) {
              const message =
                error instanceof Error
                  ? error.message
                  : 'Failed to delete discount';
              Alert.alert('Delete Failed', message);
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: DiscountCode }) => (
    <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
      <View style={styles.cardHeader}>
        <View>
          <View style={styles.codeContainer}>
            <Ionicons name="pricetag" size={16} color={colors.primary} />
            <Text style={[styles.codeText, { color: colors.text }]}>
              {item.code}
            </Text>
          </View>
          <Text style={[styles.discountValue, { color: colors.textSecondary }]}>
            {item.discount_type === 'percentage'
              ? `${item.discount_value}% OFF`
              : `${formatCurrency(item.discount_value)} OFF`}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: item.is_active
                ? colors.successLight
                : colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: item.is_active ? colors.success : colors.textMuted },
            ]}
          >
            {item.is_active ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.cardFooter}>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            Used
          </Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {item.usage_count}
            {item.usage_limit ? ` / ${item.usage_limit}` : ''}
          </Text>
        </View>

        <Pressable
          onPress={() => handleDelete(item.id, item.code)}
          disabled={deletingId !== null}
          style={({ pressed }) => [
            styles.deleteButton,
            { opacity: pressed || deletingId === item.id ? 0.7 : 1 },
          ]}
        >
          {deletingId === item.id ? (
            <ActivityIndicator size="small" color={colors.error} />
          ) : (
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          )}
        </Pressable>
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Discounts',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={handleCreateDiscount}
              style={styles.headerButton}
            >
              <Ionicons name="add" size={24} color={colors.primary} />
            </Pressable>
          ),
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <SystemBars style={isDark ? 'light' : 'dark'} />

        {isLoading ? (
          <ScreenSkeleton variant="list" cards={4} />
        ) : (
          <FlashList
            data={discounts}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            estimatedItemSize={80}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: colors.cardHover },
                  ]}
                >
                  <Ionicons
                    name="pricetag-outline"
                    size={48}
                    color={colors.primary}
                  />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  No discounts yet
                </Text>
                <Text
                  style={[
                    styles.emptyDescription,
                    { color: colors.textSecondary },
                  ]}
                >
                  Create your first discount code to boost sales.
                </Text>
                <Pressable
                  style={[
                    styles.createButton,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={handleCreateDiscount}
                >
                  <Text style={styles.createButtonText}>Create Discount</Text>
                </Pressable>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: { padding: SPACING.sm, marginLeft: -SPACING.sm },
  headerButton: { padding: SPACING.sm, marginRight: -SPACING.sm },
  listContent: { padding: SPACING.md },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  codeText: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  discountValue: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  statusText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  divider: { height: 1, marginVertical: SPACING.md },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  statLabel: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  statValue: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  deleteButton: { padding: SPACING.xs },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING['3xl'],
    paddingHorizontal: SPACING.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.size.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  createButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.full,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
