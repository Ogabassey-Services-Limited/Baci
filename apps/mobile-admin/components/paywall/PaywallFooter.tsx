import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { isRuntimePlatform } from '@/config/runtime-platform';
import type { ThemeColors } from '@/constants/theme';
import type { PurchasesPackage } from 'react-native-purchases';
import { paywallStyles } from './paywall.styles';

interface PaywallFooterProps {
  colors: ThemeColors;
  isLoading: boolean;
  isPro: boolean;
  onPurchase: () => void;
  onRestore: () => void;
  selectedPackage: PurchasesPackage | null;
  stickyFooterPaddingBottom: number;
}

export default function PaywallFooter({
  colors,
  isLoading,
  isPro,
  onPurchase,
  onRestore,
  selectedPackage,
  stickyFooterPaddingBottom,
}: PaywallFooterProps) {
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
        onPress={onPurchase}
        disabled={!selectedPackage || isLoading}
        style={({ pressed }) => [
          paywallStyles.mainButton,
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
          <Text style={paywallStyles.mainButtonText}>
            {isPro
              ? 'Manage subscription'
              : `Continue with ${selectedPackage?.product.title || 'Pro'}`}
          </Text>
        )}
      </Pressable>

      <Text
        style={[paywallStyles.subscriptionDisclosure, { color: colors.textMuted }]}
      >
        {selectedPackage && (
          <>
            Subscription auto-renews{' '}
            {selectedPackage.packageType === 'ANNUAL' ? 'yearly' : 'monthly'} at{' '}
            {selectedPackage.product.priceString} unless cancelled at least 24
            hours before the end of the current period. Manage or cancel anytime
            in your {subscriptionSettingsLabel}.
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
          <Text style={[paywallStyles.smallLink, { color: colors.textSecondary }]}>
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
          <Text style={[paywallStyles.smallLink, { color: colors.textSecondary }]}>
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
          <Text style={[paywallStyles.smallLink, { color: colors.textSecondary }]}>
            Privacy
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
