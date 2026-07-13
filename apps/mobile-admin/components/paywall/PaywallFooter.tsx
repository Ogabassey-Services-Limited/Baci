import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  View,
} from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { isRuntimePlatform } from '@/config/runtime-platform';
import type { ThemeColors } from '@/constants/theme';
import { paywallStyles } from './paywall.styles';

interface PaywallFooterProps {
  colors: ThemeColors;
  isLoading: boolean;
  isPro: boolean;
  isSubscriptionStatusLoading: boolean;
  onManageSubscription: () => void;
  onPurchase: () => void;
  onReload: () => void;
  onRestore: () => void;
  selectedPackage: PurchasesPackage | null;
  stickyFooterPaddingBottom: number;
}

export default function PaywallFooter({
  colors,
  isLoading,
  isPro,
  isSubscriptionStatusLoading,
  onManageSubscription,
  onPurchase,
  onReload,
  onRestore,
  selectedPackage,
  stickyFooterPaddingBottom,
}: PaywallFooterProps) {
  const isButtonLoading = isLoading || isSubscriptionStatusLoading;
  // No purchasable package and the user isn't entitled — the offering came back
  // empty (Play products still propagating, offline, misconfigured RevenueCat
  // offering, etc.). Never render a dead, disabled "Continue with Pro" button
  // here: Google Play rejects paywalls whose primary button does nothing
  // ("Broken Functionality"). Present a working "Try again" instead.
  const packagesUnavailable = !isPro && !selectedPackage;
  const subscriptionSettingsLabel = isRuntimePlatform('ios')
    ? 'Apple ID settings'
    : isRuntimePlatform('android')
      ? 'Google Play settings'
      : 'subscription settings';

  return (
    <View
      style={[
        paywallStyles.stickyFooter,
        {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          paddingBottom: stickyFooterPaddingBottom,
        },
      ]}
    >
      <Pressable
        onPress={
          isPro
            ? onManageSubscription
            : packagesUnavailable
              ? onReload
              : onPurchase
        }
        disabled={isButtonLoading}
        style={({ pressed }) => [
          paywallStyles.mainButton,
          {
            backgroundColor: colors.primary,
            opacity: pressed || isButtonLoading ? 0.8 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          isSubscriptionStatusLoading
            ? 'Loading subscription status'
            : isLoading
              ? 'Processing purchase'
              : isPro
                ? 'Manage your subscription'
                : packagesUnavailable
                  ? 'Reload subscription options'
                  : `Subscribe to ${selectedPackage?.product.title || 'Baci Pro'} for ${selectedPackage?.product.priceString || ''}`
        }
        accessibilityState={{ disabled: isButtonLoading }}
      >
        {isButtonLoading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={paywallStyles.mainButtonText}>
            {isPro
              ? 'Manage subscription'
              : packagesUnavailable
                ? 'Try again'
                : `Continue with ${selectedPackage?.product.title || 'Pro'}`}
          </Text>
        )}
      </Pressable>

      <Text
        style={[
          paywallStyles.subscriptionDisclosure,
          { color: colors.textMuted },
        ]}
      >
        {packagesUnavailable
          ? "Subscription options couldn't load right now. Check your connection and tap Try again."
          : selectedPackage &&
            !isPro && (
              <>
                Subscription auto-renews{' '}
                {selectedPackage.packageType === 'ANNUAL'
                  ? 'yearly'
                  : 'monthly'}{' '}
                at {selectedPackage.product.priceString} unless cancelled at
                least 24 hours before the end of the current period. Manage or
                cancel anytime in your {subscriptionSettingsLabel}.
              </>
            )}
      </Text>

      <View style={paywallStyles.footerLinks}>
        <Pressable
          onPress={onRestore}
          accessibilityRole="button"
          accessibilityLabel="Restore previous purchases"
          style={paywallStyles.footerLinkTouchTarget}
        >
          <Text
            style={[paywallStyles.smallLink, { color: colors.textSecondary }]}
          >
            Restore Purchases
          </Text>
        </Pressable>
        <Text style={{ color: colors.textMuted }}>|</Text>
        <Pressable
          onPress={() => Linking.openURL('https://usebaci.com/terms')}
          accessibilityRole="link"
          accessibilityLabel="View terms of service"
          style={paywallStyles.footerLinkTouchTarget}
        >
          <Text
            style={[paywallStyles.smallLink, { color: colors.textSecondary }]}
          >
            Terms
          </Text>
        </Pressable>
        <Text style={{ color: colors.textMuted }}>|</Text>
        <Pressable
          onPress={() => Linking.openURL('https://usebaci.com/privacy')}
          accessibilityRole="link"
          accessibilityLabel="View privacy policy"
          style={paywallStyles.footerLinkTouchTarget}
        >
          <Text
            style={[paywallStyles.smallLink, { color: colors.textSecondary }]}
          >
            Privacy
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
