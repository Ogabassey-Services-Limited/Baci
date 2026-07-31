import Ionicons from '@react-native-vector-icons/ionicons';
import { Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { analyticsConfigStyles as styles } from './analytics-config.styles';

interface AnalyticsInfoBannerProps {
  colors: ThemeColors;
}

export function AnalyticsInfoBanner({ colors }: AnalyticsInfoBannerProps) {
  return (
    <View
      style={[styles.infoBanner, { backgroundColor: `${colors.primary}10` }]}
    >
      <Ionicons name="rocket-outline" size={24} color={colors.primary} />
      <View style={styles.infoContent}>
        <Text style={[styles.infoTitle, { color: colors.text }]}>
          Server-Side Tracking
        </Text>
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          Configure CAPI tokens to track conversions even when customers use ad
          blockers. Your orders will be automatically reported to ad platforms.
        </Text>
      </View>
    </View>
  );
}
