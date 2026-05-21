import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { withTwentyPercentAlpha } from '@/utils/colors/withTwentyPercentAlpha';
import { PRO_FEATURES } from './paywall.constants';
import { paywallStyles } from './paywall.styles';

interface PaywallFeatureListProps {
  colors: ThemeColors;
}

export default function PaywallFeatureList({ colors }: PaywallFeatureListProps) {
  const checkBackgroundColor = withTwentyPercentAlpha(colors.primary);

  return (
    <View style={paywallStyles.featureList}>
      {PRO_FEATURES.map((feature) => (
        <View key={feature.id} style={paywallStyles.featureItem}>
          <View
            style={[
              paywallStyles.checkCircle,
              { backgroundColor: checkBackgroundColor },
            ]}
          >
            <Ionicons name="checkmark" size={16} color={colors.primary} />
          </View>
          <View style={paywallStyles.featureText}>
            <Text style={[paywallStyles.featureTitle, { color: colors.text }]}>
              {feature.title}
            </Text>
            <Text
              style={[paywallStyles.featureDesc, { color: colors.textSecondary }]}
            >
              {feature.desc}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
