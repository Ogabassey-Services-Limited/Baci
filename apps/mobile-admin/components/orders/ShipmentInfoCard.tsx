import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { styles } from './ShipmentFlowSheet.styles';

interface ShipmentInfoCardProps {
  colors: ThemeColors;
  icon: keyof typeof Ionicons.glyphMap;
  subtitle: string;
  title: string;
}

export function ShipmentInfoCard({
  colors,
  icon,
  subtitle,
  title,
}: ShipmentInfoCardProps) {
  return (
    <View style={[styles.infoCard, { backgroundColor: `${colors.primary}10` }]}>
      <View
        style={[
          styles.infoIconWrap,
          { backgroundColor: `${colors.primary}18` },
        ]}
      >
        <Ionicons color={colors.primary} name={icon} size={18} />
      </View>
      <View style={styles.infoCopy}>
        <Text style={[styles.infoTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.infoSubtitle, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}
