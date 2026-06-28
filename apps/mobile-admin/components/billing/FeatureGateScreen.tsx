import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SPACING } from '@/constants/theme';
import { useMerchant } from '@/hooks/useMerchant';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { useTheme } from '@/hooks/useTheme';
import { baciFeatureGates, type MobileFeatureGate } from '@/lib/feature-gates';
import { FeatureUpgradeCard } from './FeatureUpgradeCard';

type FeatureGateScreenProps = {
  children: ReactNode;
  description: string;
  feature: MobileFeatureGate;
  title: string;
};

export function FeatureGateScreen({
  children,
  description,
  feature,
  title,
}: FeatureGateScreenProps) {
  const { colors } = useTheme();
  const { merchant, isLoading } = useMerchant();
  const { isPro } = useRevenueCat();
  const router = useRouter();
  const hasAccess = isPro || baciFeatureGates.hasFeature(merchant, feature);

  if (isLoading) {
    return (
      <SafeAreaView
        edges={['bottom']}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!hasAccess) {
    return (
      <SafeAreaView
        edges={['bottom']}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.gateContent}>
          <FeatureUpgradeCard
            colors={colors}
            description={description}
            onUpgrade={() => router.push('/(admin)/subscribe')}
            title={title}
          />
        </View>
      </SafeAreaView>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gateContent: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
