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
  const { colors, isDark, shadows } = useTheme();
  const { merchant, storeUrl, isLive } = useMerchant();
  const [period, setPeriod] = useState<TimePeriod>('week');
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const { stats, revenueData, isLoading, refetch } = useDashboardStats(period);
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

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
        {/* Welcome Header */}
        <WelcomeHeader
          storeUrl={storeUrl}
          avatarUrl={merchant?.favicon_png_192_url ?? merchant?.logo_url ?? undefined}
          isLive={isLive}
          notificationCount={3}
          onNotificationPress={() => {}}
          onAvatarPress={handleAvatarPress}
        />

        {/* Setup Progress Card */}
        <View style={styles.section}>
          <ProgressCard
            title="Finish Setup"
            subtitle="Complete your store setup"
            progress={54}
            onPress={() => {}}
          />
        </View>

        {/* AI Insight Card */}
        <View style={styles.section}>
          <InsightCard
            title={`Good ${getTimeOfDay()}, ${firstName}`}
            message="Your store had 12 new visitors yesterday. Consider running a promotion to convert them!"
            icon="sparkles"
            onPress={() => {}}
            onDismiss={() => {}}
          />
        </View>

        {/* Revenue Chart with Period Picker */}
        <View style={[styles.section, { zIndex: 10 }]}>
          <View style={{ position: 'relative' }}>
            <RevenueChart
              data={revenueData.length > 0 ? revenueData : []}
              title="Revenue Overview"
              period={currentPeriodLabel}
              totalRevenue={formatCurrency(stats?.revenue ?? 0)}
              onPeriodPress={() => setShowPeriodPicker(!showPeriodPicker)}
            />

            {/* Period Picker Dropdown */}
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

        {/* Stats Row */}
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

        {/* Quick Actions */}
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
              icon="analytics-outline"
              label="Insights"
              iconColor={colors.gold}
              backgroundColor={colors.goldLight}
              onPress={() => {}}
            />
            <QuickActionButton
              icon="cube-outline"
              label="Add Product"
              iconColor={colors.orange}
              backgroundColor={colors.orangeLight}
              onPress={() => router.push('/product/new')}
            />
            <QuickActionButton
              icon="people-outline"
              label="Customers"
              iconColor={colors.success}
              backgroundColor={colors.successLight}
              onPress={() => router.push('/(tabs)/customers')}
            />
          </View>
        </View>

        {/* Bottom spacing */}
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
  periodText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
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
});
