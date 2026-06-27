import Ionicons from '@react-native-vector-icons/ionicons';
import type { ComponentProps } from 'react';
import { Text, View } from 'react-native';
import { styles } from './OrderDetailsInsuranceCard.styles';
import type { OrderDetailsInsuranceCardColors } from './OrderDetailsInsuranceCard.types';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

export function InsuranceCardHeader({
  colors,
  iconColor,
  iconName,
}: {
  colors: OrderDetailsInsuranceCardColors;
  iconColor: string;
  iconName: IoniconsName;
}) {
  return (
    <View style={styles.insuranceHeader}>
      <Ionicons name={iconName} size={20} color={iconColor} />
      <Text
        style={[
          styles.sectionTitle,
          { color: colors.text, marginBottom: 0, marginLeft: 8 },
        ]}
      >
        Insurance Coverage
      </Text>
    </View>
  );
}

export function InsuranceValueRow({
  colors,
  label,
  value,
}: {
  colors: OrderDetailsInsuranceCardColors;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.insuranceRow}>
      <Text style={[styles.insuranceLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text style={[styles.insuranceValue, { color: colors.text }]}>
        {value}
      </Text>
    </View>
  );
}
