import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { SPACING } from '@/constants/Colors';
import { checkoutScreenViewStyles as styles } from './CheckoutScreenView.styles';

type ColorsScheme = (typeof Colors)['light'];

interface CheckoutHeaderProps {
  colors: ColorsScheme;
  onBack: () => void;
}

export function CheckoutHeader({ colors, onBack }: CheckoutHeaderProps) {
  return (
    <View
      style={[
        styles.screenHeader,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
          paddingTop: 0,
          paddingBottom: SPACING.sm,
        },
      ]}
    >
      <Pressable
        onPress={onBack}
        style={styles.backBtn}
        accessibilityLabel="Go back"
        accessibilityRole="button"
        hitSlop={12}
      >
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={[styles.screenHeaderTitle, { color: colors.text }]}>
        Checkout
      </Text>
      <View style={styles.screenHeaderSpacer} />
    </View>
  );
}
