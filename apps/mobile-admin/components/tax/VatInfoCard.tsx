import { Text, View } from 'react-native';
import type { Merchant } from '@/hooks/useMerchant';
import { styles } from './styles';
import type { TaxCardShadow, TaxColors } from './types';

interface VatInfoCardProps {
  colors: TaxColors;
  shadowStyle: TaxCardShadow;
  vatRate?: Merchant['vat_rate'];
  country?: Merchant['country'];
}

export function VatInfoCard({
  colors,
  shadowStyle,
  vatRate,
  country,
}: VatInfoCardProps) {
  const formattedVatRate = vatRate != null ? `${vatRate}%` : '-';
  const formattedCountry = country?.trim() || '-';

  return (
    <View style={[styles.card, { backgroundColor: colors.card }, shadowStyle]}>
      <View style={styles.infoRow}>
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
          VAT Rate
        </Text>
        <Text style={[styles.infoValue, { color: colors.text }]}>
          {formattedVatRate}
        </Text>
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.infoRow}>
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
          Country
        </Text>
        <Text style={[styles.infoValue, { color: colors.text }]}>
          {formattedCountry}
        </Text>
      </View>
    </View>
  );
}
