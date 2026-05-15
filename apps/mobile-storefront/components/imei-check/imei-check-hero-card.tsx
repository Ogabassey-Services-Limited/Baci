import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { BRAND, withAlpha } from '@/constants/Colors';
import { styles } from './imei-check.styles';
import type { ImeiCheckerColors } from './imei-check.types';

const IMEI_TRUST_INDICATORS = [
  '15-digit check',
  'Official status',
  'Instant report',
] as const;

export default function HeroCard({ colors }: { colors: ImeiCheckerColors }) {
  return (
    <View
      style={[
        styles.heroCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.heroHeader}>
        <View
          style={[
            styles.heroIcon,
            { backgroundColor: withAlpha(BRAND.primary, 0.1) },
          ]}
        >
          <Ionicons name="barcode-outline" size={24} color={BRAND.primary} />
        </View>
        <View style={styles.heroCopy}>
          <Text
            style={[styles.heroEyebrow, { color: BRAND.primary }]}
            numberOfLines={1}
          >
            Device verification
          </Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            IMEI Checker
          </Text>
        </View>
      </View>
      <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
        Check blacklist, iCloud and SIM lock status before you pay.
      </Text>
      <View style={styles.trustIndicators}>
        {IMEI_TRUST_INDICATORS.map((item) => (
          <View
            key={item}
            style={[
              styles.trustPill,
              { backgroundColor: withAlpha(BRAND.primary, 0.06) },
            ]}
          >
            <Ionicons name="checkmark" size={12} color="#059669" />
            <Text style={[styles.trustText, { color: colors.textSecondary }]}>
              {item}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
