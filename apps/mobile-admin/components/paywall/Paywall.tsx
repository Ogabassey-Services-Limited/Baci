import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRevenueCatStore } from '@/stores/revenueCatStore';
import type { PurchasesPackage } from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { useTheme } from '@/hooks/useTheme';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../constants/theme';

const { width: _width } = Dimensions.get('window');
const DEFAULT_CLOSE_TOP = 30;
const DEFAULT_HEADER_PADDING = 50;
// Extra top spacing (dp) above safe-area inset to avoid close button overlap.
const SAFE_AREA_CLOSE_OFFSET = 11;
// Extra bottom spacing (dp) above safe-area inset to keep footer clear of system UI.
const SAFE_AREA_FOOTER_OFFSET = 6;
// Extra top spacing (dp) above safe-area inset to keep header clear of system UI.
const SAFE_AREA_HEADER_OFFSET = 26;

interface PaywallProps {
  onClose?: () => void;
}

export default function Paywall({ onClose }: PaywallProps) {
  const { colors, shadows: _shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    currentOffering,
    purchasePackage,
    restorePurchases,
    isPro,
    isLoading,
    error,
  } = useRevenueCat();

  const [selectedPackage, setSelectedPackage] =
    useState<PurchasesPackage | null>(null);
  const headerPaddingTop = Math.max(
    DEFAULT_HEADER_PADDING,
    insets.top + SAFE_AREA_HEADER_OFFSET
  );
  const closeButtonTop = Math.max(
    DEFAULT_CLOSE_TOP,
    insets.top + SAFE_AREA_CLOSE_OFFSET
  );
  const stickyFooterPaddingBottom = Math.max(
    SPACING.xl,
    insets.bottom + SAFE_AREA_FOOTER_OFFSET
  );

  useEffect(() => {
    if (error) {
      Alert.alert('Configuration Note', error);
    }
  }, [error]);

  useEffect(() => {
    // Default to yearly if available, otherwise monthly
    if (currentOffering?.availablePackages) {
      const annual = currentOffering.availablePackages.find(
        (p) => p.packageType === 'ANNUAL'
      );
      const monthly = currentOffering.availablePackages.find(
        (p) => p.packageType === 'MONTHLY'
      );
      setSelectedPackage(
        annual || monthly || currentOffering.availablePackages[0] || null
      );
    }
  }, [currentOffering]);

  const onPurchase = async () => {
    if (!selectedPackage) return;

    try {
      const isNowPro = await purchasePackage(selectedPackage);

      if (isNowPro) {
        Alert.alert('Success', 'You are now a Pro member!', [
          { text: 'OK', onPress: onClose },
        ]);
      } else {
        const storeError = useRevenueCatStore.getState().error;
        if (!storeError) {
          Alert.alert(
            'Purchase Complete',
            'Your purchase was successful! If your features don\'t appear immediately, please try "Restore Purchases".',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (err) {
      console.debug('[Paywall] Purchase interaction notice:', err);
    }
  };

  const onRestore = async () => {
    try {
      const success = await restorePurchases();
      if (success) {
        Alert.alert('Restored', 'Your purchases have been restored.', [
          { text: 'OK', onPress: onClose },
        ]);
      } else {
        Alert.alert('Notice', 'No active subscriptions found to restore.');
      }
    } catch (_err) {
      Alert.alert('Error', 'Could not restore purchases.');
    }
  };

  const PRO_FEATURES = [
    {
      id: '1',
      title: 'Unlimited Storefronts',
      desc: 'Build as many shops as you need',
    },
    {
      id: '2',
      title: 'Advanced AI Analytics',
      desc: 'Predict trends and customer behavior',
    },
    {
      id: '3',
      title: 'Premium Themes',
      desc: 'Unlock all 2026 designer storefronts',
    },
    {
      id: '4',
      title: 'Custom Domains',
      desc: 'Use your own .com or .shop domain',
    },
    {
      id: '5',
      title: 'Priority Support',
      desc: '24/7 dedicated help from our team',
    },
  ];

  if (isLoading && !currentOffering) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Premium Header */}
        <LinearGradient
          colors={[colors.primary, '#8B0000']} // Premium Baci Red Gradient
          style={[styles.header, { paddingTop: headerPaddingTop }]}
        >
          <Pressable
            style={[styles.closeButton, { top: closeButtonTop }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close paywall"
          >
            <Ionicons name="close" size={24} color="#FFF" />
          </Pressable>

          <Ionicons
            name="diamond"
            size={48}
            color="#FFF"
            style={styles.headerIcon}
          />
          <Text style={styles.headerTitle}>Baci Pro</Text>
          <Text style={styles.headerSubtitle}>
            The ultimate toolkit for modern merchants
          </Text>
        </LinearGradient>

        <View style={styles.content}>
          {/* Feature List */}
          <View style={styles.featureList}>
            {PRO_FEATURES.map((feature) => (
              <View key={feature.id} style={styles.featureItem}>
                <View
                  style={[
                    styles.checkCircle,
                    { backgroundColor: colors.primary + '20' },
                  ]}
                >
                  <Ionicons name="checkmark" size={16} color={colors.primary} />
                </View>
                <View style={styles.featureText}>
                  <Text style={[styles.featureTitle, { color: colors.text }]}>
                    {feature.title}
                  </Text>
                  <Text
                    style={[
                      styles.featureDesc,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {feature.desc}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Package Selection */}
          <View style={styles.packageContainer}>
            {currentOffering?.availablePackages.map((pack) => {
              const isActive = selectedPackage?.identifier === pack.identifier;
              const isAnnual = pack.packageType === 'ANNUAL';

              return (
                <Pressable
                  key={pack.identifier}
                  onPress={() => setSelectedPackage(pack)}
                  style={[
                    styles.tierCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: isActive ? colors.primary : colors.border,
                      borderWidth: isActive ? 2 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${isAnnual ? 'Yearly' : 'Monthly'} subscription at ${pack.product.priceString}${isAnnual ? ' per year, save 20 percent' : ' per month'}`}
                  accessibilityState={{ selected: isActive }}
                >
                  <View style={styles.tierInfo}>
                    <Text style={[styles.tierTitle, { color: colors.text }]}>
                      {isAnnual ? 'Yearly Access' : 'Monthly Access'}
                    </Text>
                    {isAnnual && (
                      <View
                        style={[
                          styles.savingsBadge,
                          { backgroundColor: colors.success },
                        ]}
                      >
                        <Text style={styles.savingsText}>SAVE 20%</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.tierPricing}>
                    <Text style={[styles.tierPrice, { color: colors.text }]}>
                      {pack.product.priceString}
                    </Text>
                    <Text
                      style={[
                        styles.tierPeriod,
                        { color: colors.textSecondary },
                      ]}
                    >
                      /{isAnnual ? 'year' : 'mo'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Actions */}
      <View
        style={[
          styles.stickyFooter,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: stickyFooterPaddingBottom,
          },
        ]}
      >
        <Pressable
          onPress={onPurchase}
          disabled={!selectedPackage || isLoading}
          style={({ pressed }) => [
            styles.mainButton,
            {
              backgroundColor: colors.primary,
              opacity: pressed || !selectedPackage || isLoading ? 0.8 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            isLoading
              ? 'Processing purchase'
              : isPro
                ? 'Manage your subscription'
                : `Subscribe to ${selectedPackage?.product.title || 'Baci Pro'} for ${selectedPackage?.product.priceString || ''}`
          }
          accessibilityState={{ disabled: !selectedPackage || isLoading }}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.mainButtonText}>
              {isPro
                ? 'Manage subscription'
                : `Continue with ${selectedPackage?.product.title || 'Pro'}`}
            </Text>
          )}
        </Pressable>

        {/* Auto-renewal disclosure - Required by Apple */}
        <Text
          style={[styles.subscriptionDisclosure, { color: colors.textMuted }]}
        >
          {selectedPackage && (
            <>
              Subscription auto-renews{' '}
              {selectedPackage.packageType === 'ANNUAL' ? 'yearly' : 'monthly'}{' '}
              at {selectedPackage.product.priceString} unless cancelled at least
              24 hours before the end of the current period. Manage or cancel
              anytime in your Apple ID settings.
            </>
          )}
        </Text>

        <View style={styles.footerLinks}>
          <Pressable
            onPress={onRestore}
            accessibilityRole="button"
            accessibilityLabel="Restore previous purchases"
            style={styles.footerLinkTouchTarget}
          >
            <Text style={[styles.smallLink, { color: colors.textSecondary }]}>
              Restore Purchases
            </Text>
          </Pressable>
          <Text style={{ color: colors.textMuted }}>|</Text>
          <Pressable
            onPress={() => Linking.openURL('https://usebaci.com/terms')}
            accessibilityRole="link"
            accessibilityLabel="View terms of service"
            style={styles.footerLinkTouchTarget}
          >
            <Text style={[styles.smallLink, { color: colors.textSecondary }]}>
              Terms
            </Text>
          </Pressable>
          <Text style={{ color: colors.textMuted }}>|</Text>
          <Pressable
            onPress={() => Linking.openURL('https://usebaci.com/privacy')}
            accessibilityRole="link"
            accessibilityLabel="View privacy policy"
            style={styles.footerLinkTouchTarget}
          >
            <Text style={[styles.smallLink, { color: colors.textSecondary }]}>
              Privacy
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 160,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: DEFAULT_HEADER_PADDING,
    paddingBottom: 25,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  closeButton: {
    position: 'absolute',
    top: DEFAULT_CLOSE_TOP,
    right: 20,
    width: 32,
    height: 32,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  headerIcon: {
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    color: '#FFF',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING['2xl'], // Added more space from the header curve
    paddingBottom: SPACING.lg,
  },
  featureList: {
    marginBottom: SPACING.lg,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    marginTop: 2,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  packageContainer: {
    gap: SPACING.md,
  },
  tierCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
  },
  tierInfo: {
    flex: 1,
  },
  tierTitle: {
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: 4,
  },
  savingsBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  savingsText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  tierPricing: {
    alignItems: 'flex-end',
  },
  tierPrice: {
    fontSize: 20,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  tierPeriod: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.xl,
    paddingBottom: SPACING.xl,
    borderTopWidth: 1,
  },
  mainButton: {
    height: 56,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  mainButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    alignItems: 'center',
  },
  smallLink: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  footerLinkTouchTarget: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xs,
  },
  subscriptionDisclosure: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
    lineHeight: 14,
    marginBottom: SPACING.sm,
  },
});
