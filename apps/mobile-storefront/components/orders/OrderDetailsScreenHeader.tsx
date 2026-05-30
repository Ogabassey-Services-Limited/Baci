import Ionicons from "@react-native-vector-icons/ionicons";
import { Text, TouchableOpacity, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { orderDetailsScreenStyles as styles } from './OrderDetailsScreen.styles';

type ColorsScheme = (typeof Colors)['light'];

interface OrderDetailsScreenHeaderProps {
  colors: ColorsScheme;
  onGoBack: () => void;
}

export function OrderDetailsScreenHeader({
  colors,
  onGoBack,
}: OrderDetailsScreenHeaderProps) {
  return (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <TouchableOpacity
        onPress={onGoBack}
        style={[styles.backButton, { borderColor: colors.border }]}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={18} color={colors.text} />
        <Text style={[styles.backButtonText, { color: colors.text }]}>
          My Orders
        </Text>
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.text }]}>
        Order Details
      </Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}
