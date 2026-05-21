import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACING } from '@/constants/theme';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { useTheme } from '@/hooks/useTheme';
import { useRevenueCatStore } from '@/stores/revenueCatStore';
import type { PurchasesPackage } from 'react-native-purchases';
import PaywallFeatureList from './PaywallFeatureList';
import PaywallFooter from './PaywallFooter';
import PaywallHeader from './PaywallHeader';
import PaywallPackageList from './PaywallPackageList';
import {
  DEFAULT_CLOSE_TOP,
  DEFAULT_HEADER_PADDING,
  SAFE_AREA_CLOSE_OFFSET,
  SAFE_AREA_FOOTER_OFFSET,
  SAFE_AREA_HEADER_OFFSET,
  getDefaultPackage,
} from './paywall.constants';
import { paywallStyles } from './paywall.styles';

interface PaywallProps {
  onClose?: () => void;
}

export default function Paywall({ onClose }: PaywallProps) {
  const { colors } = useTheme();
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
    if (!error) return;
    Alert.alert('Configuration Note', error);
  }, [error]);

  useEffect(() => {
    setSelectedPackage(getDefaultPackage(currentOffering?.availablePackages));
  }, [currentOffering]);

  const onPurchase = async () => {
    if (!selectedPackage) return;

    try {
      const isNowPro = await purchasePackage(selectedPackage);
      if (isNowPro) {
        Alert.alert('Success', 'You are now a Pro member!', [
          { text: 'OK', onPress: onClose },
        ]);
        return;
      }

      const latestError = useRevenueCatStore.getState().error;
      if (!latestError) {
        Alert.alert(
          'Purchase Complete',
          'Your purchase was successful! If your features don\'t appear immediately, please try "Restore Purchases".',
          [{ text: 'OK' }]
        );
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

  if (isLoading && !currentOffering) {
    return (
      <View style={[paywallStyles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View
      style={[paywallStyles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={paywallStyles.scrollContent}
      >
        <PaywallHeader
          closeButtonTop={closeButtonTop}
          colors={colors}
          headerPaddingTop={headerPaddingTop}
          onClose={onClose}
        />

        <View style={paywallStyles.content}>
          <PaywallFeatureList colors={colors} />
          <PaywallPackageList
            colors={colors}
            packages={currentOffering?.availablePackages ?? []}
            selectedPackage={selectedPackage}
            setSelectedPackage={setSelectedPackage}
          />
        </View>
      </ScrollView>

      <PaywallFooter
        colors={colors}
        isLoading={isLoading}
        isPro={isPro}
        onPurchase={onPurchase}
        onRestore={onRestore}
        selectedPackage={selectedPackage}
        stickyFooterPaddingBottom={stickyFooterPaddingBottom}
      />
    </View>
  );
}
