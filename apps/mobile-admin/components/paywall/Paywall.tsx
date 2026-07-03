import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACING } from '@/constants/theme';
import { useMerchant } from '@/hooks/useMerchant';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { useTheme } from '@/hooks/useTheme';
import { baciFeatureGates } from '@/lib/feature-gates';
import { SubscriptionManagement } from '@/utils/SubscriptionManagement';
import PaywallFeatureList from './PaywallFeatureList';
import PaywallFooter from './PaywallFooter';
import PaywallHeader from './PaywallHeader';
import PaywallPackageList from './PaywallPackageList';
import {
  DEFAULT_CLOSE_TOP,
  DEFAULT_HEADER_PADDING,
  getDefaultPackage,
  SAFE_AREA_CLOSE_OFFSET,
  SAFE_AREA_FOOTER_OFFSET,
  SAFE_AREA_HEADER_OFFSET,
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
    reload,
    restorePurchases,
    isPro,
    isLoading,
    error,
  } = useRevenueCat();
  const { merchant, isLoading: isMerchantLoading } = useMerchant();
  const hasServerProSubscription = baciFeatureGates.hasFullProAccess(merchant);
  const hasProSubscription = isPro || hasServerProSubscription;
  const isMerchantEntitlementLoading = !isPro && isMerchantLoading;
  const isServerManagedProSubscription = hasServerProSubscription && !isPro;
  const [selectedPackage, setSelectedPackage] =
    useState<PurchasesPackage | null>(() =>
      getDefaultPackage(currentOffering?.availablePackages)
    );
  const [prevOffering, setPrevOffering] = useState(currentOffering);

  // Re-derive the default selection inline during render when the offering
  // changes, instead of routing it through an effect (which would commit a
  // stale frame first).
  if (currentOffering !== prevOffering) {
    setPrevOffering(currentOffering);
    setSelectedPackage(getDefaultPackage(currentOffering?.availablePackages));
  }

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

  const onPurchase = async () => {
    if (!selectedPackage) return;

    try {
      const purchaseResult = await purchasePackage(selectedPackage);
      if (purchaseResult.status === 'cancelled') {
        return;
      }

      if (purchaseResult.status === 'error') {
        return;
      }

      if (purchaseResult.isPro) {
        Alert.alert('Success', 'You are now a Pro member!', [
          { text: 'OK', onPress: onClose },
        ]);
        return;
      }

      Alert.alert(
        'Purchase Complete',
        'Your purchase was successful! If your features don\'t appear immediately, please try "Restore Purchases".',
        [{ text: 'OK' }]
      );
    } catch (err) {
      console.debug('[Paywall] Purchase interaction notice:', err);
    }
  };

  const onManageSubscription = async () => {
    if (isServerManagedProSubscription) {
      Alert.alert(
        'Baci Pro is active',
        'This subscription is managed through your Baci account, not the App Store or Google Play. Contact support if you need to make changes.'
      );
      return;
    }

    try {
      await SubscriptionManagement.openNativeManagement();
    } catch (_err) {
      Alert.alert('Error', 'Unable to open subscription management');
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
      <View
        style={[paywallStyles.center, { backgroundColor: colors.background }]}
      >
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
        isPro={hasProSubscription}
        isSubscriptionStatusLoading={isMerchantEntitlementLoading}
        onManageSubscription={onManageSubscription}
        onPurchase={onPurchase}
        onReload={reload}
        onRestore={onRestore}
        selectedPackage={selectedPackage}
        stickyFooterPaddingBottom={stickyFooterPaddingBottom}
      />
    </View>
  );
}
