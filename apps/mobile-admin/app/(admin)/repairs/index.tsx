import Ionicons from '@react-native-vector-icons/ionicons';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RepairBookingListItem } from '@/components/repairs/RepairBookingListItem';
import { RepairStatusFilterChips } from '@/components/repairs/RepairStatusFilterChips';
import { SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { RepairBookingsStatusFilter } from '@/hooks/useRepairBookings';
import { useRepairBookings } from '@/hooks/useRepairBookings';
import { useTheme } from '@/hooks/useTheme';
import type { RepairBookingSummary } from '@/types/repair-booking';

export default function RepairBookingsScreen() {
  const { colors } = useTheme();
  const [statusFilter, setStatusFilter] =
    useState<RepairBookingsStatusFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const { data, error, isLoading, refetch } = useRepairBookings(statusFilter);
  const bookings = data?.bookings ?? [];

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const openBooking = (id: string) => {
    router.push(`/(admin)/repairs/${id}` as never);
  };

  const renderItem = ({ item }: { item: RepairBookingSummary }) => (
    <RepairBookingListItem booking={item} colors={colors} onPress={openBooking} />
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.filterRow}>
        <RepairStatusFilterChips
          colors={colors}
          onSelect={setStatusFilter}
          selected={statusFilter}
        />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons color={colors.error} name="alert-circle" size={48} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Failed to load repair bookings. Please try again.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              refetch();
            }}
            style={styles.retryButton}
          >
            <Ionicons color={colors.primary} name="refresh" size={18} />
            <Text style={[styles.retryText, { color: colors.primary }]}>
              Tap to retry
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          contentContainerStyle={styles.listContent}
          data={bookings}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                color={colors.border}
                name="construct-outline"
                size={64}
              />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No repair bookings yet
              </Text>
              <Text
                style={[styles.emptySubtitle, { color: colors.textSecondary }]}
              >
                New repair requests will show up here.
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl onRefresh={onRefresh} refreshing={refreshing} />
          }
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  container: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: SPACING['3xl'],
  },
  emptySubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  emptyTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  filterRow: {
    paddingVertical: SPACING.sm,
  },
  listContent: {
    padding: SPACING.md,
  },
  retryButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.md,
    padding: SPACING.sm,
  },
  retryText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
