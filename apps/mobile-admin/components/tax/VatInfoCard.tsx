import { Text, View } from 'react-native';
import { styles } from './styles';
import type { TaxCardShadow, TaxColors } from './types';

interface VatInfoCardProps {
  colors: TaxColors;
  shadowStyle: TaxCardShadow;
}

export function VatInfoCard({ colors, shadowStyle }: VatInfoCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card }, shadowStyle]}>
      <View style={styles.infoRow}>
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
          VAT Rate
        </Text>
        <Text style={[styles.infoValue, { color: colors.text }]}>7.5%</Text>
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.infoRow}>
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
          Country
        </Text>
        <Text style={[styles.infoValue, { color: colors.text }]}>Nigeria</Text>
      </View>
    </View>
  );
}
