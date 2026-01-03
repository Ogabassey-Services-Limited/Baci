/**
 * Home Dashboard Screen
 * Main dashboard with stats, quick actions, and revenue overview
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  StatusBar,
  Pressable,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
// Lazy import to avoid crash if native module not built
let ImagePicker: typeof import('expo-image-picker') | null = null;
try {
  ImagePicker = require('expo-image-picker');
} catch {
  console.log('ImagePicker not available - rebuild required');
}
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import {
  WelcomeHeader,
  StatCard,
  QuickActionButton,
  ProgressCard,
  InsightCard,
  RevenueChart,
} from '@/components/dashboard';
import { useTheme } from '@/hooks/useTheme';
import { useMerchant } from '@/hooks/useMerchant';
import { useDashboardStats, type TimePeriod } from '@/hooks/useDashboardStats';
import { SPACING, TYPOGRAPHY, RADIUS } from '@/constants/theme';

const PERIOD_OPTIONS: { value: TimePeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
];

export default function HomeScreen() {
  console.log('[HomeScreen] Rendering');
  const { colors, isDark, shadows } = useTheme();
  const { merchant, storeUrl, isLive } = useMerchant();
  const [period, setPeriod] = useState<TimePeriod>('week');
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const { stats, revenueData, topProducts, isLoading, refetch } = useDashboardStats(period);
  const queryClient = useQueryClient();
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);

  const handleAvatarPress = async () => {
    if (!ImagePicker) {
      Alert.alert('Rebuild Required', 'Please rebuild the app to enable image picking:\n\nnpx expo run:android');
      return;
    }

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library to change your favicon.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) return;

      setIsUploadingFavicon(true);
      const asset = result.assets[0];
      const fileExt = asset.uri.split('.').pop() || 'png';
      const fileName = `${merchant?.id}/favicon-${Date.now()}.${fileExt}`;

      // Fetch the image and convert to blob
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('merchant-assets')
        .upload(fileName, blob, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('merchant-assets')
        .getPublicUrl(fileName);

      // Update merchant favicon in database
      const { error: updateError } = await supabase
        .from('merchants')
        .update({ favicon_png_192_url: urlData.publicUrl })
        .eq('id', merchant?.id);

      if (updateError) {
        throw updateError;
      }

      // Invalidate merchant query to refetch
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
      Alert.alert('Success', 'Favicon updated successfully!');
    } catch (error) {
      console.error('Error updating favicon:', error);
      Alert.alert('Error', 'Failed to update favicon. Please try again.');
    } finally {
      setIsUploadingFavicon(false);
    }
  };

  const currentPeriodLabel = PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? 'This Week';

  // Get the first name for greeting
  const firstName = merchant?.business_name?.split(' ')[0] ?? 'there';

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `₦${(amount / 1000000).toFixed(1)}M`;
    }
    return `₦${amount.toLocaleString()}`;
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'today':
        return 'yesterday';
      case 'week':
        return 'last week';
      case 'month':
        return 'last month';
      default:
        return '';
    }
  };

  const getRevenueInsightText = (): string | undefined => {
    if (period === 'all' || !stats) return undefined;

    const current = stats.revenue;
    const previous = stats.previousPeriodRevenue;

    if (previous === 0 && current === 0) {
      return 'No revenue data to compare';
    }

    if (previous === 0) {
      return `New revenue this ${period === 'today' ? 'day' : period}!`;
    }

    const percentChange = ((current - previous) / previous) * 100;
    const absChange = Math.abs(percentChange).toFixed(0);

    if (percentChange > 0) {
      return `Revenue is up ${absChange}% vs ${getPeriodLabel()}`;
    } else if (percentChange < 0) {
      return `Revenue is down ${absChange}% vs ${getPeriodLabel()}`;
    } else {
      return `Revenue unchanged from ${getPeriodLabel()}`;
    }
  };

  const getRevenueInsightTrend = (): 'up' | 'down' | 'neutral' => {
    if (period === 'all' || !stats) return 'neutral';

    const current = stats.revenue;
    const previous = stats.previousPeriodRevenue;

    if (previous === 0 || current === previous) return 'neutral';
    return current > previous ? 'up' : 'down';
  };

  // Dashboard UI
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Placeholder for data, replace with actual useDashboardStats data
  const data = stats;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
      >
        <WelcomeHeader
          storeUrl={storeUrl}
          avatarUrl={merchant?.favicon_png_192_url ?? merchant?.logo_url ?? undefined}
          isLive={isLive}
          notificationCount={3}
          onNotificationPress={() => { }}
          onAvatarPress={handleAvatarPress}
        />

        <View style={styles.section}>
          <ProgressCard
            title="Finish Setup"
            subtitle="Complete your store setup"
            progress={54}
            onPress={() => { }}
          />
        </View>

        <View style={styles.section}>
          <InsightCard
            title={`Good ${getTimeOfDay()}, ${firstName}`}
            message="Your store had 12 new visitors yesterday. Consider running a promotion to convert them!"
            icon="sparkles"
            onPress={() => { }}
            onDismiss={() => { }}
          />
        </View>

        <View style={[styles.section, { zIndex: 10 }]}>
          <View style={{ position: 'relative' }}>
            <RevenueChart
              data={revenueData.length > 0 ? revenueData : []}
              title="Revenue Overview"
              period={currentPeriodLabel}
              totalRevenue={formatCurrency(stats?.revenue ?? 0)}
              onPeriodPress={() => setShowPeriodPicker(!showPeriodPicker)}
              insightText={getRevenueInsightText()}
              insightTrend={getRevenueInsightTrend()}
            />

            {showPeriodPicker && (
              <View style={styles.periodDropdownWrapper}>
                <View style={[styles.periodDropdown, { backgroundColor: colors.card }, shadows.md]}>
                  {PERIOD_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      style={[
                        styles.periodOption,
                        period === option.value && { backgroundColor: colors.goldLight },
                      ]}
                      onPress={() => {
                        setPeriod(option.value);
                        setShowPeriodPicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.periodOptionText,
                          { color: period === option.value ? colors.gold : colors.text },
                        ]}
                      >
                        {option.label}
                      </Text>
                      {period === option.value && (
                        <Ionicons name="checkmark" size={16} color={colors.gold} />
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.statsGrid}>
            <StatCard
              label="Orders"
              value={stats?.orders ?? 0}
              icon="receipt-outline"
              iconColor={colors.primary}
            />
            <StatCard
              label="Items"
              value={stats?.totalItems ?? 0}
              icon="cube-outline"
              iconColor={colors.gold}
            />
            <StatCard
              label="Visits"
              value={stats?.visits ?? 0}
              icon="globe-outline"
              iconColor={colors.info}
            />
            <StatCard
              label="New"
              value={stats?.newCustomers ?? 0}
              icon="people-outline"
              iconColor={colors.success}
            />
          </View>
        </View>

        {topProducts.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Selling Products</Text>
            <View style={[styles.topProductsCard, { backgroundColor: colors.card }, shadows.sm]}>
              {topProducts.map((product, index) => (
                <View key={product.id}>
                  {index > 0 && <View style={[styles.productDivider, { backgroundColor: colors.border }]} />}
                  <View style={styles.productRow}>
                    <View style={[styles.productRank, { backgroundColor: index === 0 ? colors.gold : colors.cardHover }]}>
                      <Text style={[styles.productRankText, { color: index === 0 ? '#FFFFFF' : colors.textMuted }]}>#{index + 1}</Text>
                    </View>
                    {product.imageUrl ? (
                      <Image source={{ uri: product.imageUrl }} style={styles.productImage} />
                    ) : (
                      <View style={[styles.productImagePlaceholder, { backgroundColor: colors.cardHover }]}>
                        <Ionicons name="cube-outline" size={20} color={colors.textMuted} />
                      </View>
                    )}
                    <View style={styles.productInfo}>
                      <Text style={[styles.productName, { color: colors.text }]} numberOfLines={1}>{product.name}</Text>
                      <Text style={[styles.productStats, { color: colors.textSecondary }]}>
                        {product.totalSold} sold
                      </Text>
                    </View>
                    <Text style={[styles.productRevenue, { color: colors.success }]}>
                      {formatCurrency(product.totalRevenue)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <QuickActionButton
              icon="add-circle-outline"
              label="Add Order"
              iconColor={colors.primary}
              backgroundColor={colors.primaryLight}
              onPress={() => router.push('/order/new')}
            />
            <QuickActionButton
              icon="mail-outline"
              label="Send Emails"
              iconColor={colors.gold}
              backgroundColor={colors.goldLight}
              onPress={() => { }}
            />
            <QuickActionButton
              icon="cube-outline"
              label="Add Product"
              iconColor={colors.orange}
              backgroundColor={colors.orangeLight}
              onPress={() => router.push('/product/new')}
            />
            <QuickActionButton
              icon="newspaper-outline"
              label="Blog Manager"
              iconColor={colors.success}
              backgroundColor={colors.successLight}
              onPress={() => router.push('/blog')}
            />
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING['3xl'],
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    position: 'relative',
    zIndex: 10,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  periodSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
  },
  periodDropdownWrapper: {
    position: 'absolute',
    top: 60,
    left: SPACING.lg,
    zIndex: 100,
  },
  periodDropdown: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    minWidth: 140,
  },
  periodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  periodOptionText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  bottomSpacer: {
    height: 20,
  },
  topProductsCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  productDivider: {
    height: 1,
    marginVertical: SPACING.md,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  productRank: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productRankText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  productImage: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
  },
  productImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  productStats: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  productRevenue: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
});
