import Ionicons from '@react-native-vector-icons/ionicons';
import { Linking, Pressable, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import { trackOrderScreenStyles as styles } from './TrackOrderScreen.styles';
import type { TrackOrderData } from './TrackOrderScreen.types';

type ColorsScheme = (typeof Colors)['light'];

interface TrackOrderContactCardProps {
  colors: ColorsScheme;
  merchant: TrackOrderData['merchant'];
}

export function TrackOrderContactCard({
  colors,
  merchant,
}: TrackOrderContactCardProps) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Need Help?
      </Text>
      <Text style={[styles.contactDesc, { color: colors.textSecondary }]}>
        Contact {merchant.name} for any questions about your order.
      </Text>
      <View style={styles.contactRow}>
        {merchant.support_email && (
          <ContactButton
            colors={colors}
            icon="mail-outline"
            label="Email"
            onPress={() => Linking.openURL(`mailto:${merchant.support_email}`)}
          />
        )}
        {merchant.support_phone && (
          <ContactButton
            colors={colors}
            icon="call-outline"
            label="Call"
            onPress={() => Linking.openURL(`tel:${merchant.support_phone}`)}
          />
        )}
      </View>
    </View>
  );
}

function ContactButton({
  colors,
  icon,
  label,
  onPress,
}: {
  colors: ColorsScheme;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.contactBtn,
        { borderColor: colors.border },
        pressed && { opacity: 0.7, backgroundColor: `${colors.border}20` },
      ]}
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${label} support`}
      accessibilityHint={
        label === 'Email' ? 'Opens your email app' : 'Opens your phone dialer'
      }
    >
      <Ionicons name={icon} size={18} color={BRAND.primary} />
      <Text style={[styles.contactBtnText, { color: colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}
