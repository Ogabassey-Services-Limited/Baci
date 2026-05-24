import Ionicons from "@react-native-vector-icons/ionicons/static";
import { Text, View } from 'react-native';
import { styles } from './styles';
import type { TaxColors } from './types';

interface TaxNoticeCardProps {
  colors: TaxColors;
}

export function TaxNoticeCard({ colors }: TaxNoticeCardProps) {
  return (
    <View
      style={[
        styles.notice,
        { backgroundColor: colors.infoLight || '#EFF6FF' },
      ]}
    >
      <Ionicons
        name="information-circle"
        size={20}
        color={colors.info || '#3B82F6'}
      />
      <Text style={[styles.noticeText, { color: colors.info || '#3B82F6' }]}>
        VAT is automatically calculated and shown separately on invoices. Ensure
        you are registered with FIRS before enabling VAT collection.
      </Text>
    </View>
  );
}
